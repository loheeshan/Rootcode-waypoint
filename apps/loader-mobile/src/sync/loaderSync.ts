import type { SQLiteDatabase } from 'expo-sqlite';
import { ApiError, type SyncBatchRequest, type SyncBatchResponse, type TripLoadingResponse } from '@waypoint/api-contracts';
import type { Outbox, SyncReport } from '@waypoint/mobile-sync';

import { getApiClient } from '../services/api';
import { session } from '../services/session';
import { openReadyRequests, saveTripView, setReadyRequest } from './store';

/**
 * Sends only while the session that started the run is still the current one, so a sign-out or
 * account switch mid-run can never submit one user's events with another user's token.
 */
function pinned(token: string | null) {
  const check = async () => {
    if (!token || (await session.getToken()) !== token) throw new ApiError(401, 'The signed-in account changed');
  };
  return {
    send: async (batch: SyncBatchRequest) => {
      await check();
      return getApiClient().request<SyncBatchResponse>('/sync/events', { method: 'POST', body: JSON.stringify(batch) });
    },
    fetchView: async (tripId: string) => {
      await check();
      const view = await getApiClient().request<TripLoadingResponse>(`/trips/${tripId}/loading`);
      await check(); // Never store a response read under another account.
      return view;
    },
  };
}

export type LoaderSyncReport = SyncReport & { readyWaiting: boolean };

const editable = (status: string) => status === 'PLANNED' || status === 'LOADING';

/**
 * One sync pass for the signed-in Loader:
 * 1. send queued load events (oldest first);
 * 2. for each "mark ready" request whose trip has no unsent or failed load events, read the trip
 *    from the server and only then queue TRIP_READY with the server's latest event sequence
 *    (the request ID stays the same; its payload is fixed from that point);
 * 3. send that, record the outcome, and refresh the cached trips that changed.
 * Nothing is shown as READY unless the server returned it.
 */
export async function runLoaderSync(db: SQLiteDatabase, outbox: Outbox, userId: string): Promise<LoaderSyncReport> {
  const { send, fetchView } = pinned(await session.getToken());
  const report = await outbox.sync(userId, send);
  if (report.stop !== 'done') return { ...report, readyWaiting: (await openReadyRequests(db, userId)).length > 0 };
  const touched = new Set([...report.synced, ...report.failed].map((e) => e.trip_id));

  let queued = false;
  for (const request of await openReadyRequests(db, userId)) {
    if (request.status !== 'waiting') continue;
    const loads = (await outbox.list(userId, { tripId: request.trip_id, statuses: ['pending', 'syncing', 'failed'] }))
      .filter((e) => e.type === 'LOAD_RECORDED');
    if (loads.some((e) => e.status === 'failed')) {
      await setReadyRequest(db, request.request_id, 'failed',
        'A loading change was not applied. Review it on the checklist, then mark the trip ready again.');
      continue;
    }
    if (loads.length) continue; // Still waiting for load acknowledgements.
    let view: TripLoadingResponse;
    try {
      view = await fetchView(request.trip_id);
    } catch {
      continue; // Offline or unavailable: try again on the next pass.
    }
    await saveTripView(db, userId, view);
    touched.delete(request.trip_id);
    if (!editable(view.trip.status)) {
      await setReadyRequest(db, request.request_id, view.trip.status === 'READY' ? 'done' : 'failed',
        view.trip.status === 'READY' ? 'The trip was already marked ready.' : 'Loading is finalized for this trip.');
      continue;
    }
    if (view.pending_count > 0 || view.loaded_count === 0) {
      await setReadyRequest(db, request.request_id, 'failed', view.pending_count > 0
        ? `The server still has ${view.pending_count} order(s) without an outcome. Check them, then mark ready again.`
        : 'No order is loaded on the server. Load at least one order, then mark ready again.');
      continue;
    }
    // Payload fixed from here on. If the app stopped after the insert last time, reuse that event.
    if (!(await outbox.get(userId, request.request_id))) {
      await outbox.add(userId, {
        event_id: request.request_id,
        type: 'TRIP_READY',
        trip_id: request.trip_id,
        payload: { last_event_sequence: view.last_event_sequence },
      });
    }
    await setReadyRequest(db, request.request_id, 'queued');
    queued = true;
  }

  let final: SyncReport = report;
  if (queued) {
    const second = await outbox.sync(userId, send);
    final = { ...second, synced: [...report.synced, ...second.synced], failed: [...report.failed, ...second.failed] };
    for (const e of [...second.synced, ...second.failed]) touched.add(e.trip_id);
  }

  for (const request of await openReadyRequests(db, userId)) {
    if (request.status !== 'queued') continue;
    const event = await outbox.get(userId, request.request_id);
    if (event?.status === 'synced') {
      await setReadyRequest(db, request.request_id, 'done');
      if (event.result) {
        await saveTripView(db, userId, event.result as unknown as TripLoadingResponse);
        touched.delete(request.trip_id);
      }
    } else if (event?.status === 'failed') {
      // The reason moves to the ready request (shown on Depart); the rejected TRIP_READY leaves the
      // queue so it does not block this trip's later loading changes or a new ready request.
      await setReadyRequest(db, request.request_id, 'failed', event.detail ?? 'The server did not accept the ready request.');
      await outbox.discard(userId, request.request_id);
      touched.add(request.trip_id);
    }
  }

  // Keep cached trips in step with what the server now holds (best effort; offline is fine).
  for (const tripId of touched) {
    try {
      await saveTripView(db, userId, await fetchView(tripId));
    } catch {
      // Keep the previous cached copy.
    }
  }
  return { ...final, readyWaiting: (await openReadyRequests(db, userId)).length > 0 };
}
