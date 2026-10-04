import type { SQLiteDatabase } from 'expo-sqlite';
import { Outbox } from '@waypoint/mobile-sync';

import { asSqlDatabase } from '../sync/sqlite';

/**
 * Local schema. Every row is scoped by the signed-in user's ID (and trip where relevant), so an
 * account switch on a shared phone never shows or sends another person's work.
 *
 * v1 (foundation placeholder, never written to) is replaced by v2.
 */
export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  // The shared outbox schema is idempotent (CREATE ... IF NOT EXISTS), so it is applied every start.
  await Outbox.migrate(asSqlDatabase(db));
  if (version >= 2) return;
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DROP TABLE IF EXISTS cached_trips;
      DROP TABLE IF EXISTS cached_stops;
      DROP TABLE IF EXISTS outbox_events;
      DROP TABLE IF EXISTS sync_state;
      CREATE TABLE IF NOT EXISTS driver_trip_lists (
        user_id TEXT NOT NULL, delivery_date TEXT NOT NULL, payload TEXT NOT NULL, fetched_at TEXT NOT NULL,
        PRIMARY KEY (user_id, delivery_date)
      );
      CREATE TABLE IF NOT EXISTS driver_trip_views (
        user_id TEXT NOT NULL, trip_id TEXT NOT NULL, payload TEXT NOT NULL, fetched_at TEXT NOT NULL,
        PRIMARY KEY (user_id, trip_id)
      );
      CREATE TABLE IF NOT EXISTS driver_deliver_intents (
        intent_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        trip_id TEXT NOT NULL,
        stop_id TEXT NOT NULL,
        pod_id TEXT NOT NULL,
        photo_uri TEXT NOT NULL,
        receiver_name TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'uploading', 'uploaded', 'queued', 'failed', 'done')),
        detail TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS driver_deliver_intents_user ON driver_deliver_intents (user_id, trip_id, status);
    `);
    await db.execAsync('PRAGMA user_version = 2;');
  });
}
