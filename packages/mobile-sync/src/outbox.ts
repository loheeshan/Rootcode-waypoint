import {
  ApiError,
  type SyncBatchRequest,
  type SyncBatchResponse,
  type SyncEventRequest,
  type SyncEventType,
  type SyncOutcome,
} from '@waypoint/api-contracts';

/**
 * The subset of expo-sqlite's async API the outbox needs. Each app passes its own database
 * (the Driver and Loader run different Expo SDKs), so this package has no native imports.
 */
export type SqlValue = string | number | null;
export interface SqlDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: SqlValue[]): Promise<{ changes: number }>;
  getAllAsync<T>(sql: string, params: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: SqlValue[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

/** pending: waiting to send · syncing: in a request · synced: server accepted · failed: needs attention. */
export type OutboxStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface NewOutboxEvent {
  /** Generated once when the user acts; never changed afterwards. */
  event_id: string;
  type: SyncEventType;
  trip_id: string;
  stop_id?: string | null;
  /** What the event is about in the UI (an order or stop ID). */
  subject_id?: string | null;
  /** The REST body without its ID field, exactly as it will be sent. */
  payload: Record<string, unknown>;
}

export interface OutboxEvent extends Required<NewOutboxEvent> {
  seq: number;
  user_id: string;
  status: OutboxStatus;
  attempts: number;
  next_attempt_at: string;
  outcome: SyncOutcome | null;
  http_status: number | null;
  detail: string | null;
  /** The server's domain response once applied. */
  result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/** Why a sync run ended. Only `done` means nothing due is left. */
export type SyncStop = 'done' | 'busy' | 'offline' | 'unauthorized' | 'forbidden' | 'server';
export interface SyncReport {
  stop: SyncStop;
  /** Events the server accepted in this run (APPLIED or DUPLICATE), with their trips. */
  synced: OutboxEvent[];
  /** Events moved to needs-attention in this run (REJECTED or CONFLICT). */
  failed: OutboxEvent[];
  /** When the earliest waiting event may be retried, if any. */
  nextAttemptAt: string | null;
}

export type SendBatch = (batch: SyncBatchRequest) => Promise<SyncBatchResponse>;
type Failure = Exclude<SyncStop, 'done' | 'busy'>;

export interface OutboxOptions {
  now?: () => Date;
  uuid: () => string;
  /** Delay before retry number `attempts` (1-based). Bounded; default 2 s doubling to 5 min. */
  backoffMs?: (attempts: number) => number;
}

/** Backend limit (MAX_BATCH in apps/api/app/sync/schemas.py). */
export const MAX_BATCH = 50;
const DEFAULT_BACKOFF = (attempts: number) => Math.min(2_000 * 2 ** Math.max(0, attempts - 1), 300_000);
const SYNCED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

type Row = Omit<OutboxEvent, 'payload' | 'result'> & { payload: string; result: string | null };
const parse = (row: Row): OutboxEvent => ({
  ...row,
  payload: JSON.parse(row.payload) as Record<string, unknown>,
  result: row.result ? JSON.parse(row.result) as Record<string, unknown> : null,
});

/** Classify a whole-batch failure. Anything that is not an HTTP answer is treated as offline. */
export function classifyFailure(error: unknown): Failure {
  if (!(error instanceof ApiError)) return 'offline';
  if (error.status === 401) return 'unauthorized';
  if (error.status === 403) return 'forbidden';
  return 'server';
}

/**
 * Durable, per-account queue of sync events in SQLite.
 *
 * - An event is stored (status `pending`) before the UI calls it saved; its ID and payload are
 *   immutable (enforced by a trigger), so retries always resend identical data.
 * - Events go oldest first, at most 50 per request. Within a trip nothing is sent while an earlier
 *   event of that trip is waiting for a retry or needs attention (causal order).
 * - Every query is scoped by user ID: another account's events are never listed or sent.
 */
export class Outbox {
  private readonly now: () => Date;
  private readonly uuid: () => string;
  private readonly backoff: (attempts: number) => number;
  private running = false;

  constructor(private readonly db: SqlDatabase, options: OutboxOptions) {
    this.now = options.now ?? (() => new Date());
    this.uuid = options.uuid;
    this.backoff = options.backoffMs ?? DEFAULT_BACKOFF;
  }

  static async migrate(db: SqlDatabase): Promise<void> {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_outbox (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        trip_id TEXT NOT NULL,
        stop_id TEXT,
        subject_id TEXT,
        payload TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'syncing', 'synced', 'failed')),
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT NOT NULL,
        outcome TEXT,
        http_status INTEGER,
        detail TEXT,
        result TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sync_outbox_user_status ON sync_outbox (user_id, status, seq);
      CREATE INDEX IF NOT EXISTS sync_outbox_user_trip ON sync_outbox (user_id, trip_id, seq);
      CREATE TRIGGER IF NOT EXISTS sync_outbox_immutable
        BEFORE UPDATE OF event_id, user_id, type, trip_id, stop_id, subject_id, payload ON sync_outbox
        BEGIN SELECT RAISE(ABORT, 'outbox events are immutable'); END;
      CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
  }

  /** Stable per-install ID sent with every batch for tracing. */
  async deviceId(): Promise<string> {
    const row = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM sync_meta WHERE key = ?', ['device_id']);
    if (row) return row.value;
    const id = this.uuid();
    await this.db.runAsync('INSERT OR IGNORE INTO sync_meta (key, value) VALUES (?, ?)', ['device_id', id]);
    return (await this.db.getFirstAsync<{ value: string }>('SELECT value FROM sync_meta WHERE key = ?', ['device_id']))!.value;
  }

  /** Store a new event as pending. Call inside the app's transaction when it also writes local state. */
  async add(userId: string, event: NewOutboxEvent): Promise<void> {
    const at = this.now().toISOString();
    await this.db.runAsync(
      `INSERT INTO sync_outbox (event_id, user_id, type, trip_id, stop_id, subject_id, payload, status, next_attempt_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      [event.event_id, userId, event.type, event.trip_id, event.stop_id ?? null, event.subject_id ?? null,
        JSON.stringify(event.payload), at, at, at],
    );
  }

  async get(userId: string, eventId: string): Promise<OutboxEvent | null> {
    const row = await this.db.getFirstAsync<Row>('SELECT * FROM sync_outbox WHERE user_id = ? AND event_id = ?', [userId, eventId]);
    return row ? parse(row) : null;
  }

  /** Events of one account, oldest first; optionally one trip and/or some statuses. */
  async list(userId: string, filter: { tripId?: string; statuses?: OutboxStatus[] } = {}): Promise<OutboxEvent[]> {
    const where = ['user_id = ?'];
    const params: SqlValue[] = [userId];
    if (filter.tripId) { where.push('trip_id = ?'); params.push(filter.tripId); }
    if (filter.statuses?.length) {
      where.push(`status IN (${filter.statuses.map(() => '?').join(', ')})`);
      params.push(...filter.statuses);
    }
    const rows = await this.db.getAllAsync<Row>(`SELECT * FROM sync_outbox WHERE ${where.join(' AND ')} ORDER BY seq`, params);
    return rows.map(parse);
  }

  async counts(userId: string): Promise<Record<OutboxStatus, number>> {
    const rows = await this.db.getAllAsync<{ status: OutboxStatus; n: number }>(
      'SELECT status, COUNT(*) AS n FROM sync_outbox WHERE user_id = ? GROUP BY status', [userId]);
    const counts: Record<OutboxStatus, number> = { pending: 0, syncing: 0, synced: 0, failed: 0 };
    for (const row of rows) counts[row.status] = row.n;
    return counts;
  }

  /**
   * After a relaunch nothing can still be in flight: requests that were `syncing` go back to
   * `pending` and are resent unchanged (the server answers DUPLICATE if it already applied them).
   * Synced events older than a week are removed.
   */
  async recover(): Promise<void> {
    const at = this.now();
    await this.db.runAsync(`UPDATE sync_outbox SET status = 'pending', updated_at = ? WHERE status = 'syncing'`, [at.toISOString()]);
    await this.db.runAsync(`DELETE FROM sync_outbox WHERE status = 'synced' AND updated_at < ?`,
      [new Date(at.getTime() - SYNCED_RETENTION_MS).toISOString()]);
  }

  /** Remove a needs-attention event after the user has seen the server's reason. */
  async discard(userId: string, eventId: string): Promise<boolean> {
    const result = await this.db.runAsync(
      `DELETE FROM sync_outbox WHERE user_id = ? AND event_id = ? AND status = 'failed'`, [userId, eventId]);
    return result.changes > 0;
  }

  /** Make waiting events due now (e.g. the user tapped "Sync now" or the network came back). */
  async retryNow(userId: string): Promise<void> {
    await this.db.runAsync(`UPDATE sync_outbox SET next_attempt_at = ? WHERE user_id = ? AND status = 'pending'`,
      [this.now().toISOString(), userId]);
  }

  /** Send due events for one account until none are left or the server/network stops us. */
  async sync(userId: string, send: SendBatch): Promise<SyncReport> {
    const report: SyncReport = { stop: 'done', synced: [], failed: [], nextAttemptAt: null };
    if (this.running) return { ...report, stop: 'busy' };
    this.running = true;
    try {
      const deviceId = await this.deviceId();
      for (let round = 0; round < 100; round += 1) {
        const batch = await this.nextBatch(userId);
        if (!batch.length) break;
        const ids = batch.map((e) => e.event_id);
        await this.setStatus(ids, 'syncing');
        let response: SyncBatchResponse;
        try {
          response = await send({ device_id: deviceId, events: batch.map(toRequest) });
        } catch (error) {
          report.stop = classifyFailure(error);
          // Nothing is known to have been applied; resend the same events later.
          await this.requeue(batch, report.stop !== 'unauthorized' && report.stop !== 'forbidden');
          break;
        }
        await this.applyResults(batch, response, report);
        // The server answered, so events that only failed to reach it are due now (their backoff was
        // for the network). Events the server asked to RETRY keep their backoff.
        await this.db.runAsync(
          `UPDATE sync_outbox SET next_attempt_at = ? WHERE user_id = ? AND status = 'pending' AND outcome IS NULL AND next_attempt_at > ?`,
          [this.now().toISOString(), userId, this.now().toISOString()]);
      }
      report.nextAttemptAt = await this.earliestPending(userId);
      return report;
    } finally {
      this.running = false;
    }
  }

  /** Due pending events in creation order, skipping any trip that is waiting on an earlier event. */
  private async nextBatch(userId: string): Promise<OutboxEvent[]> {
    const open = (await this.db.getAllAsync<Row>(
      `SELECT * FROM sync_outbox WHERE user_id = ? AND status != 'synced' ORDER BY seq`, [userId])).map(parse);
    const now = this.now().toISOString();
    const blocked = new Set<string>();
    const batch: OutboxEvent[] = [];
    for (const event of open) {
      if (blocked.has(event.trip_id)) continue;
      if (event.status !== 'pending' || event.next_attempt_at > now) {
        blocked.add(event.trip_id);
        continue;
      }
      batch.push(event);
      if (batch.length === MAX_BATCH) break;
    }
    return batch;
  }

  private async applyResults(batch: OutboxEvent[], response: SyncBatchResponse, report: SyncReport) {
    const byIndex = new Map(response.results.map((r) => [r.index, r]));
    const at = this.now();
    // Row-by-row on purpose: expo-sqlite transactions are not exclusive, so a rollback could also undo
    // an event the UI stored meanwhile. Each update is safe alone; after a crash, rows still `syncing`
    // are resent unchanged and the server answers DUPLICATE.
    {
      for (const [index, event] of batch.entries()) {
        const result = byIndex.get(index);
        if (!result || (result.event_id && result.event_id !== event.event_id)) {
          await this.retryLater(event, at, null, null, 'The server did not report this event');
          continue;
        }
        const common = [result.outcome, result.http_status, result.detail, at.toISOString()];
        switch (result.outcome) {
          case 'APPLIED':
          case 'DUPLICATE':
            await this.db.runAsync(
              `UPDATE sync_outbox SET status = 'synced', outcome = ?, http_status = ?, detail = ?, updated_at = ?, result = ? WHERE event_id = ?`,
              [...common, result.result ? JSON.stringify(result.result) : null, event.event_id]);
            report.synced.push({ ...event, status: 'synced', outcome: result.outcome, result: result.result });
            break;
          case 'REJECTED':
          case 'CONFLICT':
            await this.db.runAsync(
              `UPDATE sync_outbox SET status = 'failed', outcome = ?, http_status = ?, detail = ?, updated_at = ? WHERE event_id = ?`,
              [...common, event.event_id]);
            report.failed.push({ ...event, status: 'failed', outcome: result.outcome, detail: result.detail });
            break;
          case 'SKIPPED':
            // Not attempted; it goes again once the earlier event of its trip is resolved.
            await this.db.runAsync(
              `UPDATE sync_outbox SET status = 'pending', outcome = ?, http_status = ?, detail = ?, updated_at = ? WHERE event_id = ?`,
              [...common, event.event_id]);
            break;
          default:
            await this.retryLater(event, at, result.outcome, result.http_status, result.detail);
        }
      }
    }
  }

  private async retryLater(event: OutboxEvent, at: Date, outcome: SyncOutcome | null, status: number | null, detail: string | null) {
    const attempts = event.attempts + 1;
    await this.db.runAsync(
      `UPDATE sync_outbox SET status = 'pending', attempts = ?, next_attempt_at = ?, outcome = ?, http_status = ?, detail = ?, updated_at = ? WHERE event_id = ?`,
      [attempts, new Date(at.getTime() + this.backoff(attempts)).toISOString(), outcome, status, detail, at.toISOString(), event.event_id]);
  }

  private async requeue(batch: OutboxEvent[], countAttempt: boolean) {
    const at = this.now();
    for (const event of batch) {
      if (countAttempt) await this.retryLater(event, at, null, null, null);
      else await this.setStatus([event.event_id], 'pending');
    }
  }

  private async setStatus(ids: string[], status: OutboxStatus) {
    const at = this.now().toISOString();
    for (const id of ids) {
      await this.db.runAsync('UPDATE sync_outbox SET status = ?, updated_at = ? WHERE event_id = ?', [status, at, id]);
    }
  }

  /** When the next send can happen: the earliest retry time among the first open event of each trip. */
  private async earliestPending(userId: string): Promise<string | null> {
    const rows = await this.db.getAllAsync<{ trip_id: string; status: OutboxStatus; next_attempt_at: string }>(
      `SELECT trip_id, status, next_attempt_at FROM sync_outbox WHERE user_id = ? AND status != 'synced' ORDER BY seq`, [userId]);
    const seen = new Set<string>();
    let earliest: string | null = null;
    for (const row of rows) {
      if (seen.has(row.trip_id)) continue;
      seen.add(row.trip_id);
      if (row.status === 'pending' && (earliest === null || row.next_attempt_at < earliest)) earliest = row.next_attempt_at;
    }
    return earliest;
  }
}

function toRequest(event: OutboxEvent): SyncEventRequest {
  return {
    event_id: event.event_id,
    type: event.type,
    trip_id: event.trip_id,
    ...(event.stop_id ? { stop_id: event.stop_id } : {}),
    payload: event.payload,
  } as SyncEventRequest;
}
