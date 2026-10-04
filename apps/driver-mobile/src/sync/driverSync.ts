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
 * 1. upload proof photos of confirmed deliveries (idempotent by pod_id). STOP_DELIVERED events that
 *    reference them are already queued in order; nothing is sent while a proof could not be uploaded
 *    for a transient reason, so a delivery never reaches the server before its proof;
 * 2. send the queue (oldest first);
 * 3. settle deliveries from their event outcome and refresh cached trips that changed.
 */
export async function runDriverSync(db: SQLiteDatabase, outbox: Outbox, userId: string): Promise<DriverSyncReport> {
  const api = pinned(await session.getToken());
  const waiting = async () => (await openDeliverIntents(db, userId)).some((i) => i.status === 'pending');

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
        // Rejected proof: the queued delivery will come back as a conflict for the driver to review.
        await setDeliverIntentStatus(db, intent.intent_id, 'failed', error.message);
        continue;
      }
      return { stop, synced: [], failed: [], nextAttemptAt: null, proofsWaiting: await waiting() };
    }
  }

  const report = await outbox.sync(userId, api.send);
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
