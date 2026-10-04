import type { SQLiteDatabase } from 'expo-sqlite';
import { ApiError, type DriverTripDetailResponse, type PodResponse, type SyncBatchRequest, type SyncBatchResponse } from '@waypoint/api-contracts';
import { classifyFailure, type Outbox, type SyncReport } from '@waypoint/mobile-sync';

import { discardPhoto, readBase64 } from '../features/driving/podDraft';
import { getApiClient } from '../services/api';
import { session } from '../services/session';
import { openDeliverIntents, saveTripView, setDeliverIntentStatus } from './store';

export type DriverSyncReport = SyncReport & { proofsWaiting: boolean };

/** Requests only while the session that started the run is still current (no cross-account sends). */
function pinned(token: string | null) {
  const check = async () => {
    if (!token || (await session.getToken()) !== token) throw new ApiError(401, 'The signed-in account changed');
  };
  const post = async <T,>(path: string, body: unknown) => {
    await check();
    return getApiClient().request<T>(path, { method: 'POST', body: JSON.stringify(body) });
  };
  return {
    send: (batch: SyncBatchRequest) => post<SyncBatchResponse>('/sync/events', batch),
    uploadPod: (tripId: string, stopId: string, body: unknown) => post<PodResponse>(`/trips/${tripId}/stops/${stopId}/pod`, body),
    fetchView: async (tripId: string) => {
      await check();
      const view = await getApiClient().request<DriverTripDetailResponse>(`/trips/${tripId}`);
      await check();
      return view;
    },
  };
}

/**
 * One sync pass for the signed-in Driver:
 * 1. upload proof photos of confirmed deliveries (idempotent by pod_id). A proof can only be added
 *    after the server has the arrival, so a proof whose earlier trip events (start/arrive done
 *    offline) are still queued waits instead of failing;
 * 2. send the queue (oldest first), holding back each delivery whose proof is not on the server yet
 *    and the later events of its trip, so a delivery never reaches the server before its proof;
 * 3. upload the proofs that were waiting for those events and send the held deliveries;
 * 4. settle deliveries from their event outcome and refresh cached trips that changed.
 */
export async function runDriverSync(db: SQLiteDatabase, outbox: Outbox, userId: string): Promise<DriverSyncReport> {
  const api = pinned(await session.getToken());
  const waiting = async () => (await openDeliverIntents(db, userId)).some((i) => i.status === 'pending');

  /** Earlier events of the delivery's trip that the server has not applied yet. */
  const earlierQueued = async (tripId: string, deliveryEventId: string) => {
    const events = await outbox.list(userId, { tripId });
    const delivery = events.find((e) => e.event_id === deliveryEventId);
    return events.some((e) => e.status !== 'synced' && (!delivery || e.seq < delivery.seq));
  };

  /** Uploads pending proofs; returns a stop reason when the network/server stopped the pass. */
  const uploadProofs = async (): Promise<SyncReport['stop'] | null> => {
    for (const intent of await openDeliverIntents(db, userId)) {
      if (intent.status !== 'pending') continue;
      try {
        let photo: string;
        try {
          photo = await readBase64(intent.photo_uri);
        } catch {
          await setDeliverIntentStatus(db, intent.intent_id, 'failed', 'The proof photo is no longer on this phone. Discard this delivery and record it again.');
          continue;
        }
        await api.uploadPod(intent.trip_id, intent.stop_id, {
          pod_id: intent.pod_id,
          receiver_name: intent.receiver_name,
          photo_mime_type: 'image/jpeg',
          photo_base64: photo,
          captured_at: intent.captured_at,
        });
        await setDeliverIntentStatus(db, intent.intent_id, 'uploaded');
        discardPhoto(intent.photo_uri);
      } catch (error) {
        const stop = classifyFailure(error);
        if (error instanceof ApiError && error.status !== 401 && error.status !== 403 && error.status < 500) {
          // Not yet: the start/arrival queued on this phone must reach the server first.
          if (error.status === 409 && await earlierQueued(intent.trip_id, intent.intent_id)) continue;
          // Rejected proof: the queued delivery will come back as a conflict for the driver to review.
          await setDeliverIntentStatus(db, intent.intent_id, 'failed', error.message);
          continue;
        }
        return stop;
      }
    }
    return null;
  };

  /** Sends a batch without deliveries whose proof is still waiting (nor later events of their trip). */
  const sendReady = async (batch: SyncBatchRequest): Promise<SyncBatchResponse> => {
    const held = new Set((await openDeliverIntents(db, userId)).filter((i) => i.status === 'pending').map((i) => i.intent_id));
    const heldTrips = new Set<string>();
    const sendable: number[] = [];
    batch.events.forEach((event, index) => {
      if (held.has(event.event_id)) heldTrips.add(event.trip_id);
      if (!heldTrips.has(event.trip_id)) sendable.push(index);
    });
    const response = sendable.length === batch.events.length ? await api.send(batch)
      : sendable.length ? await api.send({ ...batch, events: sendable.map((i) => batch.events[i]) })
        : { device_id: batch.device_id, received_at: new Date().toISOString(), results: [], counts: {} as SyncBatchResponse['counts'] };
    if (sendable.length === batch.events.length) return response;
    const results = response.results.map((r) => ({ ...r, index: sendable[r.index] }));
    batch.events.forEach((event, index) => {
      if (!sendable.includes(index)) {
        results.push({ index, event_id: event.event_id, type: event.type, trip_id: event.trip_id, outcome: 'RETRY',
          // Not sent: no HTTP status. RETRY keeps it queued (with backoff) until its proof is on the server.
          http_status: null as unknown as number, detail: 'Waiting for the proof of delivery to upload', result: null });
      }
    });
    return { ...response, results: results.sort((a, b) => a.index - b.index) };
  };

  const proofStop = await uploadProofs();
  if (proofStop) return { stop: proofStop, synced: [], failed: [], nextAttemptAt: null, proofsWaiting: await waiting() };

  let report = await outbox.sync(userId, sendReady);
  if (report.stop === 'done' && await waiting()) {
    // The start/arrival just reached the server: upload the waiting proofs, then send the deliveries.
    const stop = await uploadProofs();
    if (stop) report = { ...report, stop };
    else {
      await outbox.retryNow(userId);
      const next = await outbox.sync(userId, sendReady);
      report = { ...next, synced: [...report.synced, ...next.synced], failed: [...report.failed, ...next.failed] };
    }
  }
  const touched = new Set([...report.synced, ...report.failed].map((e) => e.trip_id));

  for (const intent of await openDeliverIntents(db, userId)) {
    const event = await outbox.get(userId, intent.intent_id);
    if (event?.status === 'synced') await setDeliverIntentStatus(db, intent.intent_id, 'done');
    else if (event?.status === 'failed') await setDeliverIntentStatus(db, intent.intent_id, 'failed', event.detail);
    else if (!event) await setDeliverIntentStatus(db, intent.intent_id, 'failed', 'The delivery was discarded.');
  }

  if (report.stop === 'done') {
    for (const tripId of touched) {
      try {
        await saveTripView(db, userId, await api.fetchView(tripId));
      } catch {
        // Keep the previous cached copy.
      }
    }
  }
  return { ...report, proofsWaiting: await waiting() };
}
