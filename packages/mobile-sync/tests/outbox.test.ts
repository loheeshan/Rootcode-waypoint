import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError, type SyncBatchRequest, type SyncBatchResponse, type SyncOutcome } from '@waypoint/api-contracts';

import { Outbox, type SqlDatabase, type SqlValue } from '../src';

/** expo-sqlite's async API over Node's built-in SQLite, so the real SQL and trigger run. */
function memoryDb(): SqlDatabase {
  const db = new DatabaseSync(':memory:');
  return {
    async execAsync(sql) { db.exec(sql); },
    async runAsync(sql, params: SqlValue[]) {
      const r = db.prepare(sql).run(...params);
      return { changes: Number(r.changes) };
    },
    async getAllAsync<T>(sql: string, params: SqlValue[]) { return db.prepare(sql).all(...params) as T[]; },
    async getFirstAsync<T>(sql: string, params: SqlValue[]) { return (db.prepare(sql).get(...params) as T) ?? null; },
    async withTransactionAsync(task) {
      db.exec('BEGIN');
      try { await task(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

let clock = new Date('2026-10-04T10:00:00Z');
let ids = 0;
let db: SqlDatabase;
let outbox: Outbox;
const sent: SyncBatchRequest[] = [];

const load = (id: string, trip = 'trip-1', order = `order-${id}`) => ({
  event_id: id, type: 'LOAD_RECORDED' as const, trip_id: trip, subject_id: order,
  payload: { order_id: order, status: 'LOADED', note: null },
});

/** A server that answers each event with the outcome chosen for its event_id (default APPLIED). */
const server = (outcomes: Record<string, SyncOutcome> = {}) => async (batch: SyncBatchRequest): Promise<SyncBatchResponse> => {
  sent.push(batch);
  const blocked = new Set<string>();
  const results = batch.events.map((e, index) => {
    const outcome: SyncOutcome = blocked.has(e.trip_id) ? 'SKIPPED' : outcomes[e.event_id] ?? 'APPLIED';
    if (outcome !== 'APPLIED' && outcome !== 'DUPLICATE' && outcome !== 'SKIPPED') blocked.add(e.trip_id);
    if (outcome === 'SKIPPED') blocked.add(e.trip_id);
    const status = { APPLIED: 201, DUPLICATE: 200, REJECTED: 422, CONFLICT: 409, RETRY: 503, SKIPPED: 424 }[outcome];
    return { index, event_id: e.event_id, type: e.type, trip_id: e.trip_id, outcome, http_status: status,
      detail: outcome === 'APPLIED' ? null : `${outcome} detail`, result: outcome === 'APPLIED' ? { sequence_number: index + 1 } : null };
  });
  return { device_id: batch.device_id, received_at: clock.toISOString(), results, counts: {} as SyncBatchResponse['counts'] };
};

beforeEach(async () => {
  clock = new Date('2026-10-04T10:00:00Z');
  ids = 0;
  sent.length = 0;
  db = memoryDb();
  await Outbox.migrate(db);
  outbox = new Outbox(db, { now: () => clock, uuid: () => `device-${++ids}` });
});

describe('Outbox', () => {
  it('stores events durably and sends them once, oldest first', async () => {
    await outbox.add('u1', load('e1'));
    await outbox.add('u1', load('e2'));
    expect((await outbox.counts('u1')).pending).toBe(2);
    const report = await outbox.sync('u1', server());
    expect(report.stop).toBe('done');
    expect(sent).toHaveLength(1);
    expect(sent[0].events.map((e) => e.event_id)).toEqual(['e1', 'e2']);
    expect(sent[0].events[0]).toEqual({ event_id: 'e1', type: 'LOAD_RECORDED', trip_id: 'trip-1', payload: { order_id: 'order-e1', status: 'LOADED', note: null } });
    expect((await outbox.counts('u1')).synced).toBe(2);
    await outbox.sync('u1', server());
    expect(sent).toHaveLength(1);
  });

  it('keeps one device ID across runs', async () => {
    expect(await outbox.deviceId()).toBe(await outbox.deviceId());
  });

  it('never changes an event ID or payload', async () => {
    await outbox.add('u1', load('e1'));
    await expect(db.runAsync(`UPDATE sync_outbox SET payload = '{}' WHERE event_id = 'e1'`, [])).rejects.toThrow(/immutable/);
    await expect(outbox.add('u1', load('e1'))).rejects.toThrow();
  });

  it('respects the 50-event batch limit', async () => {
    for (let i = 0; i < 120; i += 1) await outbox.add('u1', load(`e${i}`, `trip-${i % 3}`));
    await outbox.sync('u1', server());
    expect(sent.map((b) => b.events.length)).toEqual([50, 50, 20]);
    expect((await outbox.counts('u1')).synced).toBe(120);
  });

  it('partial failure: conflict needs attention, later events of that trip wait, other trips continue', async () => {
    await outbox.add('u1', load('a1', 'A'));
    await outbox.add('u1', load('a2', 'A'));
    await outbox.add('u1', load('b1', 'B'));
    const report = await outbox.sync('u1', server({ a1: 'CONFLICT' }));
    expect(report.failed.map((e) => e.event_id)).toEqual(['a1']);
    const events = Object.fromEntries((await outbox.list('u1')).map((e) => [e.event_id, e.status]));
    expect(events).toEqual({ a1: 'failed', a2: 'pending', b1: 'synced' });
    // a2 is not sent while a1 needs attention, and a1 is never resent automatically.
    sent.length = 0;
    await outbox.sync('u1', server());
    expect(sent).toHaveLength(0);
    // After the user discards a1, a2 goes with its original ID and payload.
    expect(await outbox.discard('u1', 'a1')).toBe(true);
    await outbox.sync('u1', server());
    expect(sent[0].events.map((e) => e.event_id)).toEqual(['a2']);
  });

  it('RETRY backs off (bounded) and resends the same event unchanged', async () => {
    await outbox.add('u1', load('e1'));
    await outbox.add('u1', load('e2'));
    const report = await outbox.sync('u1', server({ e1: 'RETRY' }));
    expect(report.nextAttemptAt).toBe('2026-10-04T10:00:02.000Z');
    expect((await outbox.list('u1')).map((e) => [e.status, e.outcome])).toEqual([['pending', 'RETRY'], ['pending', 'SKIPPED']]);
    sent.length = 0;
    await outbox.sync('u1', server());
    expect(sent).toHaveLength(0); // not due yet, and e2 must not overtake e1
    clock = new Date('2026-10-04T10:00:03Z');
    await outbox.sync('u1', server());
    expect(sent[0].events.map((e) => e.event_id)).toEqual(['e1', 'e2']);
  });

  it('network failure keeps events pending; after a relaunch interrupted events are resent', async () => {
    await outbox.add('u1', load('e1'));
    const offline = await outbox.sync('u1', async () => { throw new TypeError('Network request failed'); });
    expect(offline.stop).toBe('offline');
    expect((await outbox.get('u1', 'e1'))!.status).toBe('pending');
    // Simulate a crash mid-request.
    await db.runAsync(`UPDATE sync_outbox SET status = 'syncing'`, []);
    const relaunched = new Outbox(db, { now: () => clock, uuid: () => 'x' });
    await relaunched.recover();
    clock = new Date('2026-10-04T11:00:00Z');
    await relaunched.sync('u1', server({ e1: 'DUPLICATE' }));
    expect((await relaunched.get('u1', 'e1'))!.status).toBe('synced');
  });

  it('401 and 403 stop the run without counting attempts or dropping events', async () => {
    await outbox.add('u1', load('e1'));
    expect((await outbox.sync('u1', async () => { throw new ApiError(401, 'expired'); })).stop).toBe('unauthorized');
    expect((await outbox.sync('u1', async () => { throw new ApiError(403, 'revoked'); })).stop).toBe('forbidden');
    const event = (await outbox.get('u1', 'e1'))!;
    expect([event.status, event.attempts]).toEqual(['pending', 0]);
  });

  it('keeps accounts apart', async () => {
    await outbox.add('u1', load('e1'));
    await outbox.add('u2', load('e2', 'trip-2'));
    expect((await outbox.list('u2')).map((e) => e.event_id)).toEqual(['e2']);
    await outbox.sync('u2', server());
    expect(sent[0].events.map((e) => e.event_id)).toEqual(['e2']);
    expect((await outbox.get('u1', 'e1'))!.status).toBe('pending');
    expect(await outbox.get('u2', 'e1')).toBeNull();
    expect(await outbox.discard('u2', 'e1')).toBe(false);
  });

  it('runs one sync at a time', async () => {
    await outbox.add('u1', load('e1'));
    let release!: () => void;
    const slow = (batch: SyncBatchRequest) => new Promise<SyncBatchResponse>((resolve) => { release = () => resolve(server()(batch)); });
    const first = outbox.sync('u1', slow);
    await new Promise((r) => setTimeout(r, 0));
    expect((await outbox.sync('u1', server())).stop).toBe('busy');
    release();
    expect((await first).stop).toBe('done');
    expect(sent).toHaveLength(1);
  });

  it('once the server answers, events that only hit network errors are sent without waiting out their backoff', async () => {
    await outbox.add('u1', load('a1', 'A'));
    await outbox.sync('u1', async () => { throw new TypeError('Network request failed'); });
    await outbox.add('u1', load('b1', 'B')); // due now; a1 waits out its network backoff
    await outbox.sync('u1', server());
    expect(sent.map((b) => b.events.map((e) => e.event_id))).toEqual([['b1'], ['a1']]);
    expect((await outbox.counts('u1')).synced).toBe(2);
  });
});
