import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type SyncBatchRequest, type SyncEventResult } from '@waypoint/api-contracts';
import { Outbox, type SqlDatabase, type SqlValue } from '@waypoint/mobile-sync';

// The native modules driverSync.ts reaches are replaced; the outbox runs on real SQLite.
type Intent = { intent_id: string; user_id: string; trip_id: string; stop_id: string; pod_id: string; photo_uri: string; receiver_name: string; captured_at: string; status: string; detail: string | null };
const intents: Intent[] = [];
const uploads: string[] = [];
let online = true;

/** A fake API with the server's ordering rules: proof only after arrival, delivery only with proof. */
const server = { started: false, arrived: false, pod: false, delivered: false, completed: false, applied: new Set<string>() };
function apply(event: SyncBatchRequest['events'][number]): Pick<SyncEventResult, 'outcome' | 'http_status' | 'detail'> {
  if (server.applied.has(event.event_id)) return { outcome: 'DUPLICATE', http_status: 200, detail: null };
  const ok = { TRIP_STARTED: !server.started, STOP_ARRIVED: server.started && !server.arrived,
    STOP_DELIVERED: server.arrived && server.pod, STOP_FAILED: server.arrived, TRIP_COMPLETED: server.delivered,
    LOAD_RECORDED: false, TRIP_READY: false }[event.type];
  if (!ok) return { outcome: 'CONFLICT', http_status: 409, detail: event.type === 'STOP_DELIVERED' ? 'Upload proof of delivery for this stop first' : 'Not allowed now' };
  server.applied.add(event.event_id);
  if (event.type === 'TRIP_STARTED') server.started = true;
  if (event.type === 'STOP_ARRIVED') server.arrived = true;
  if (event.type === 'STOP_DELIVERED') server.delivered = true;
  if (event.type === 'TRIP_COMPLETED') server.completed = true;
  return { outcome: 'APPLIED', http_status: 201, detail: null };
}
const client = {
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!online) throw new TypeError('Network request failed');
    if (path === '/sync/events') {
      const batch = JSON.parse(init.body as string) as SyncBatchRequest;
      const results = batch.events.map((e, index) => ({ index, event_id: e.event_id, type: e.type, trip_id: e.trip_id, result: {}, ...apply(e) }));
      return { device_id: batch.device_id, received_at: '', results, counts: {} } as unknown as T;
    }
    if (path.endsWith('/pod')) {
      if (!server.arrived) throw new ApiError(409, 'API request failed (409)', 'Proof of delivery can only be added after arriving at the stop');
      uploads.push((JSON.parse(init.body as string) as { pod_id: string }).pod_id);
      server.pod = true;
      return {} as T;
    }
    return { trip: {}, stops: [] } as T;
  },
};
vi.mock('../src/services/api', () => ({ getApiClient: () => client }));
vi.mock('../src/services/session', () => ({ session: { getToken: async () => 'token' } }));
vi.mock('../src/features/driving/podDraft', () => ({ readBase64: async () => 'BASE64', discardPhoto: () => undefined }));
vi.mock('../src/sync/store', () => ({
  openDeliverIntents: async (_db: unknown, user: string) => intents.filter((i) => i.user_id === user && ['pending', 'uploading', 'uploaded', 'queued'].includes(i.status)),
  setDeliverIntentStatus: async (_db: unknown, id: string, status: string, detail: string | null = null) => {
    Object.assign(intents.find((i) => i.intent_id === id)!, { status, detail });
  },
  saveTripView: async () => undefined,
}));

const { runDriverSync } = await import('../src/sync/driverSync');

function memoryDb(): SqlDatabase {
  const db = new DatabaseSync(':memory:');
  return {
    async execAsync(sql) { db.exec(sql); },
    async runAsync(sql, params: SqlValue[]) { return { changes: Number(db.prepare(sql).run(...params).changes) }; },
    async getAllAsync<T>(sql: string, params: SqlValue[]) { return db.prepare(sql).all(...params) as T[]; },
    async getFirstAsync<T>(sql: string, params: SqlValue[]) { return (db.prepare(sql).get(...params) as T) ?? null; },
    async withTransactionAsync(task) { db.exec('BEGIN'); try { await task(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } },
  };
}

let outbox: Outbox;
let ids = 0;
const USER = 'driver-1';
const queue = async (type: 'TRIP_STARTED' | 'STOP_ARRIVED' | 'STOP_DELIVERED' | 'TRIP_COMPLETED', payload: Record<string, unknown> = {}) => {
  const event_id = `event-${++ids}`;
  await outbox.add(USER, { event_id, type, trip_id: 'trip-1', stop_id: type.startsWith('STOP') ? 'stop-1' : null, payload });
  return event_id;
};
/** What the Deliver button stores: the intent shares the STOP_DELIVERED event ID. */
const deliver = async () => {
  const id = await queue('STOP_DELIVERED', { pod_id: 'pod-1' });
  intents.push({ intent_id: id, user_id: USER, trip_id: 'trip-1', stop_id: 'stop-1', pod_id: 'pod-1', photo_uri: 'file://pod.jpg', receiver_name: 'R', captured_at: '', status: 'pending', detail: null });
  return id;
};

beforeEach(async () => {
  intents.length = 0;
  uploads.length = 0;
  online = true;
  Object.assign(server, { started: false, arrived: false, pod: false, delivered: false, completed: false, applied: new Set() });
  const db = memoryDb();
  await Outbox.migrate(db);
  outbox = new Outbox(db, { uuid: () => `device-${++ids}` });
});

describe('runDriverSync', () => {
  it('delivers a stop that was started, arrived and delivered entirely offline', async () => {
    online = false;
    await queue('TRIP_STARTED');
    await queue('STOP_ARRIVED');
    const delivered = await deliver();
    await queue('TRIP_COMPLETED');
    expect((await runDriverSync({} as never, outbox, USER)).stop).toBe('offline');
    expect(server.started).toBe(false);

    online = true;
    const report = await runDriverSync({} as never, outbox, USER);
    expect(report.failed).toEqual([]);
    expect(report.stop).toBe('done');
    expect(server).toMatchObject({ started: true, arrived: true, pod: true, delivered: true, completed: true });
    expect(uploads).toEqual(['pod-1']);
    expect(intents[0].status).toBe('done');
    expect((await outbox.get(USER, delivered))?.status).toBe('synced');
    expect(report.proofsWaiting).toBe(false);
  });

  it('uploads the proof first when the arrival is already on the server', async () => {
    await queue('TRIP_STARTED');
    await queue('STOP_ARRIVED');
    await runDriverSync({} as never, outbox, USER);
    expect(server.arrived).toBe(true);
    await deliver();
    const report = await runDriverSync({} as never, outbox, USER);
    expect(report.failed).toEqual([]);
    expect(server.delivered).toBe(true);
    expect(uploads).toEqual(['pod-1']);
  });

  it('marks a proof failed when the server rejects it and nothing earlier is waiting', async () => {
    server.started = true; // started elsewhere, but this stop was never arrived on the server
    await deliver();
    const report = await runDriverSync({} as never, outbox, USER);
    expect(intents[0].status).toBe('failed');
    expect(report.failed.map((e) => e.type)).toEqual(['STOP_DELIVERED']);
    expect(uploads).toEqual([]);
  });
});
