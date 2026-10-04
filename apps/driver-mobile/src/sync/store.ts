import type { SQLiteDatabase } from 'expo-sqlite';
import type { DriverTripDetailResponse, DriverTripResponse } from '@waypoint/api-contracts';

/** Server responses cached per user, plus the Driver's local "deliver" intents. */
export type Cached<T> = { value: T; fetchedAt: string };

/**
 * Deliver intent: the Driver taps "confirm delivered" while offline or before the proof uploads.
 * - pending:   photo on phone, waiting for connectivity.
 * - uploading: POD upload in progress.
 * - uploaded:  POD confirmed by the server; STOP_DELIVERED can now be queued.
 * - queued:    STOP_DELIVERED event is in the outbox.
 * - failed:    something went wrong (detail says what); the driver can discard.
 * - done:      the server applied the delivery event; photo can be cleaned up.
 */
export type DeliverIntentStatus = 'pending' | 'uploading' | 'uploaded' | 'queued' | 'failed' | 'done';
export interface DeliverIntent {
  intent_id: string;
  user_id: string;
  trip_id: string;
  stop_id: string;
  pod_id: string;
  photo_uri: string;
  receiver_name: string;
  captured_at: string;
  status: DeliverIntentStatus;
  detail: string | null;
  created_at: string;
  updated_at: string;
}

const now = () => new Date().toISOString();

// ─── Trip lists ───

export async function saveTripList(db: SQLiteDatabase, userId: string, date: string, trips: DriverTripResponse[]) {
  await db.runAsync(
    `INSERT INTO driver_trip_lists (user_id, delivery_date, payload, fetched_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, delivery_date) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
    [userId, date, JSON.stringify(trips), now()]);
}

export async function readTripList(db: SQLiteDatabase, userId: string, date: string): Promise<Cached<DriverTripResponse[]> | null> {
  const row = await db.getFirstAsync<{ payload: string; fetched_at: string }>(
    'SELECT payload, fetched_at FROM driver_trip_lists WHERE user_id = ? AND delivery_date = ?', [userId, date]);
  return row ? { value: JSON.parse(row.payload) as DriverTripResponse[], fetchedAt: row.fetched_at } : null;
}

// ─── Trip details ───

export async function saveTripView(db: SQLiteDatabase, userId: string, view: DriverTripDetailResponse) {
  await db.runAsync(
    `INSERT INTO driver_trip_views (user_id, trip_id, payload, fetched_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, trip_id) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
    [userId, view.trip.trip_id, JSON.stringify(view), now()]);
}

export async function readTripView(db: SQLiteDatabase, userId: string, tripId: string): Promise<Cached<DriverTripDetailResponse> | null> {
  const row = await db.getFirstAsync<{ payload: string; fetched_at: string }>(
    'SELECT payload, fetched_at FROM driver_trip_views WHERE user_id = ? AND trip_id = ?', [userId, tripId]);
  return row ? { value: JSON.parse(row.payload) as DriverTripDetailResponse, fetchedAt: row.fetched_at } : null;
}

// ─── Deliver intents ───

export async function addDeliverIntent(
  db: SQLiteDatabase, userId: string, tripId: string, stopId: string,
  podId: string, photoUri: string, receiverName: string, capturedAt: string, intentId: string,
) {
  const at = now();
  await db.runAsync(
    `INSERT INTO driver_deliver_intents (intent_id, user_id, trip_id, stop_id, pod_id, photo_uri, receiver_name, captured_at, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [intentId, userId, tripId, stopId, podId, photoUri, receiverName, capturedAt, at, at]);
}

export async function setDeliverIntentStatus(db: SQLiteDatabase, intentId: string, status: DeliverIntentStatus, detail: string | null = null) {
  await db.runAsync('UPDATE driver_deliver_intents SET status = ?, detail = ?, updated_at = ? WHERE intent_id = ?',
    [status, detail, now(), intentId]);
}

/** The newest deliver intent for a stop. */
export async function latestDeliverIntent(db: SQLiteDatabase, userId: string, stopId: string): Promise<DeliverIntent | null> {
  return db.getFirstAsync<DeliverIntent>(
    'SELECT * FROM driver_deliver_intents WHERE user_id = ? AND stop_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1',
    [userId, stopId]);
}

/** All open (not done) deliver intents for a user, oldest first. */
export async function openDeliverIntents(db: SQLiteDatabase, userId: string): Promise<DeliverIntent[]> {
  return db.getAllAsync<DeliverIntent>(
    `SELECT * FROM driver_deliver_intents WHERE user_id = ? AND status IN ('pending', 'uploading', 'uploaded', 'queued') ORDER BY created_at, rowid`, [userId]);
}

/** All deliver intents for a specific trip. */
export async function tripDeliverIntents(db: SQLiteDatabase, userId: string, tripId: string): Promise<DeliverIntent[]> {
  return db.getAllAsync<DeliverIntent>(
    `SELECT * FROM driver_deliver_intents WHERE user_id = ? AND trip_id = ? ORDER BY created_at, rowid`, [userId, tripId]);
}
