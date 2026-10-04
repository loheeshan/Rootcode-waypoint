import type { SQLiteDatabase } from 'expo-sqlite';
import type { LoaderTripResponse, TripLoadingResponse } from '@waypoint/api-contracts';

/** Server responses cached per user, plus the Loader's local "mark ready" requests. */
export type Cached<T> = { value: T; fetchedAt: string };

export type ReadyStatus = 'waiting' | 'queued' | 'failed' | 'done';
export type ReadyRequest = {
  request_id: string;
  user_id: string;
  trip_id: string;
  /** waiting: loading changes still syncing · queued: TRIP_READY in the outbox · failed: needs attention · done: server accepted. */
  status: ReadyStatus;
  detail: string | null;
  created_at: string;
  updated_at: string;
};

const now = () => new Date().toISOString();

export async function saveTripList(db: SQLiteDatabase, userId: string, date: string, trips: LoaderTripResponse[]) {
  await db.runAsync(
    `INSERT INTO loader_trip_lists (user_id, delivery_date, payload, fetched_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, delivery_date) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
    [userId, date, JSON.stringify(trips), now()]);
}

export async function readTripList(db: SQLiteDatabase, userId: string, date: string): Promise<Cached<LoaderTripResponse[]> | null> {
  const row = await db.getFirstAsync<{ payload: string; fetched_at: string }>(
    'SELECT payload, fetched_at FROM loader_trip_lists WHERE user_id = ? AND delivery_date = ?', [userId, date]);
  return row ? { value: JSON.parse(row.payload) as LoaderTripResponse[], fetchedAt: row.fetched_at } : null;
}

export async function saveTripView(db: SQLiteDatabase, userId: string, view: TripLoadingResponse) {
  await db.runAsync(
    `INSERT INTO loader_trip_views (user_id, trip_id, payload, fetched_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, trip_id) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
    [userId, view.trip.trip_id, JSON.stringify(view), now()]);
}

export async function readTripView(db: SQLiteDatabase, userId: string, tripId: string): Promise<Cached<TripLoadingResponse> | null> {
  const row = await db.getFirstAsync<{ payload: string; fetched_at: string }>(
    'SELECT payload, fetched_at FROM loader_trip_views WHERE user_id = ? AND trip_id = ?', [userId, tripId]);
  return row ? { value: JSON.parse(row.payload) as TripLoadingResponse, fetchedAt: row.fetched_at } : null;
}

export async function addReadyRequest(db: SQLiteDatabase, userId: string, tripId: string, requestId: string) {
  const at = now();
  await db.runAsync(
    `INSERT INTO loader_ready_requests (request_id, user_id, trip_id, status, created_at, updated_at) VALUES (?, ?, ?, 'waiting', ?, ?)`,
    [requestId, userId, tripId, at, at]);
}

export async function setReadyRequest(db: SQLiteDatabase, requestId: string, status: ReadyStatus, detail: string | null = null) {
  await db.runAsync('UPDATE loader_ready_requests SET status = ?, detail = ?, updated_at = ? WHERE request_id = ?',
    [status, detail, now(), requestId]);
}

/** The newest ready request for a trip, if any. */
export async function latestReadyRequest(db: SQLiteDatabase, userId: string, tripId: string): Promise<ReadyRequest | null> {
  return db.getFirstAsync<ReadyRequest>(
    'SELECT * FROM loader_ready_requests WHERE user_id = ? AND trip_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1',
    [userId, tripId]);
}

export async function openReadyRequests(db: SQLiteDatabase, userId: string): Promise<ReadyRequest[]> {
  return db.getAllAsync<ReadyRequest>(
    `SELECT * FROM loader_ready_requests WHERE user_id = ? AND status IN ('waiting', 'queued') ORDER BY created_at, rowid`, [userId]);
}
