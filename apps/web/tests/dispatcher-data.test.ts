import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@waypoint/api-contracts';
import {
  buildOptimizeRequest, createRequestKeeper, defaultShiftStart, exceeds, failureMessage, getPublication, getResults,
  isUncertain, listOrders, openPlan, optimizePlan, publishRevision, readDaily, requiredFuelDays, sumDecimals,
  validFuel, validateShift, weekStart, writeDaily,
} from '../features/dispatcher/data/dispatcher';

afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const call = (mock: ReturnType<typeof vi.fn>, i = 0) => {
  const [url, init] = mock.mock.calls[i] as [string, RequestInit];
  return { url, init, headers: init.headers as Headers, body: init.body ? JSON.parse(init.body as string) : undefined };
};

describe('Dispatcher helpers', () => {
  it('sums decimal strings exactly and compares against capacity', () => {
    expect(sumDecimals(['0.1', '0.2'])).toBe('0.300');
    expect(sumDecimals(['800.000', '400.125', '0.875'])).toBe('1201.000');
    expect(sumDecimals([])).toBe('0.000');
    expect(exceeds('1200.001', '1200.000')).toBe(true);
    expect(exceeds('1200.000', '1200.000')).toBe(false);
  });

  it('accepts fuel totals as the API does (zero allowed, no sign, exponent or 4th decimal)', () => {
    for (const ok of ['0', '0.000', '12.5', '999999999.999']) expect(validFuel(ok)).toBe(true);
    for (const bad of ['', '-1', '1e3', '1.2345', '1,5', '1000000000']) expect(validFuel(bad)).toBe(false);
  });

  it('lists the consumed-fuel days the optimizer needs (Monday to today)', () => {
    expect(weekStart('2026-10-08')).toBe('2026-10-05'); // Thursday -> Monday
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
    expect(requiredFuelDays('2026-10-08', '2026-10-07')).toEqual(['2026-10-05', '2026-10-06', '2026-10-07']);
    expect(requiredFuelDays('2026-10-12', '2026-10-07')).toEqual([]); // next week has not started
    expect(requiredFuelDays('2026-10-05', '2026-10-05')).toEqual(['2026-10-05']);
  });

  it('validates shifts and suggests a departure the server will accept', () => {
    expect(validateShift({ vehicle_id: 'v', start: '07:30', end: '18:00', turnaroundMinutes: 15 })).toBeNull();
    expect(validateShift({ vehicle_id: 'v', start: '18:00', end: '07:30', turnaroundMinutes: 15 })).toMatch(/after/);
    expect(validateShift({ vehicle_id: 'v', start: '7:30', end: '18:00', turnaroundMinutes: 15 })).toMatch(/HH:MM/);
    // 09:12 Colombo (03:42 UTC) -> 09:42 rounded up to 09:45.
    expect(defaultShiftStart('2026-10-04', new Date('2026-10-04T03:42:00Z'))).toBe('09:45');
    expect(defaultShiftStart('2026-10-05', new Date('2026-10-04T03:42:00Z'))).toBe('07:30');
  });
});

describe('Optimize request', () => {
  it('maps every eligible outlet and available vehicle and labels synthetic travel data', () => {
    const request = buildOptimizeRequest({
      requestId: 'req-1', day: '2026-10-05', outletIds: ['o2', 'o1', 'o2'], serviceMinutes: 10,
      shifts: [{ vehicle_id: 'v1', start: '07:30', end: '18:00', turnaroundMinutes: 15 }],
    });
    expect(request.request_id).toBe('req-1');
    expect(request.is_synthetic).toBe(true);
    expect(request.source).toMatch(/Synthetic/);
    expect(request.services).toEqual([{ outlet_id: 'o1', service_seconds: 600 }, { outlet_id: 'o2', service_seconds: 600 }]);
    expect(request.shifts).toEqual([{
      vehicle_id: 'v1', earliest_departure: '2026-10-05T07:30:00+05:30', latest_return: '2026-10-05T18:00:00+05:30', turnaround_seconds: 900,
    }]);
    // Every directed pair among depot (null) and both outlets, no self legs: 3 * 2.
    expect(request.legs).toHaveLength(6);
    const pairs = new Set(request.legs.map((l) => `${l.from_outlet_id}>${l.to_outlet_id}`));
    expect(pairs.size).toBe(6);
    expect(request.legs.find((l) => l.from_outlet_id === null)).toMatchObject({ distance_km: '6.000', travel_seconds: 900 });
    expect(request.legs.find((l) => l.from_outlet_id === 'o1' && l.to_outlet_id === 'o2')).toMatchObject({ distance_km: '3.000', travel_seconds: 600 });
    expect(typeof request.legs[0].distance_km).toBe('string');
  });

  it('sends no shifts or legs beyond the depot for an empty day', () => {
    const request = buildOptimizeRequest({ requestId: 'r', day: '2026-10-05', outletIds: [], shifts: [], serviceMinutes: 10 });
    expect(request).toMatchObject({ services: [], shifts: [], legs: [] });
  });
});

describe('Request IDs', () => {
  it('reuses one ID for the same payload until the action is confirmed', () => {
    let n = 0;
    const keeper = createRequestKeeper(() => `id-${++n}`);
    expect(keeper.idFor({ a: 1 })).toBe('id-1');
    expect(keeper.idFor({ a: 1 })).toBe('id-1'); // retry after an uncertain failure
    expect(keeper.idFor({ a: 2 })).toBe('id-2'); // changed inputs are a new action
    keeper.settle();
    expect(keeper.idFor({ a: 2 })).toBe('id-3'); // a deliberate new run after success
  });

  it('treats network and server errors as uncertain and shows the server reason otherwise', () => {
    expect(isUncertain(new TypeError('fetch failed'))).toBe(true);
    expect(isUncertain(new ApiError(503, 'x', 'Optimization unavailable; retry with the same request ID'))).toBe(true);
    expect(isUncertain(new ApiError(409, 'x'))).toBe(false);
    const stale = new ApiError(409, 'x', 'Current orders, fleet or fuel no longer match this revision; run a new optimization');
    expect(failureMessage(stale)).toBe('Current orders, fleet or fuel no longer match this revision; run a new optimization');
    expect(failureMessage(new ApiError(422, 'x', [{ loc: ['body', 'driver_assignments'], msg: 'Field required' }]))).toBe('driver assignments: Field required');
    expect(failureMessage(new TypeError('offline'), 'The publication')).toMatch(/may not have been saved; retrying sends the same request/);
    expect(failureMessage(new ApiError(401, 'x'))).toMatch(/expired/);
  });
});

describe('Dispatcher API calls', () => {
  it('lists depot orders through the proxy with the client header and server pagination', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ items: [], total: 0, limit: 20, offset: 40 }));
    vi.stubGlobal('fetch', fetchMock);
    await listOrders({ depot_id: 'd1', status: 'CONFIRMED', requested_delivery_date: '2026-10-05', offset: 40 });
    const { url, headers } = call(fetchMock);
    expect(url).toBe('/api/backend/dispatcher/orders?depot_id=d1&status=CONFIRMED&requested_delivery_date=2026-10-05&offset=40&limit=20');
    expect(headers.get('X-Waypoint-Client')).toBe('web');
  });

  it('creates a missing daily input with If-None-Match and replaces with the GET ETag, sending decimal strings', async () => {
    const record = { id: 'f', vehicle_id: 'v1', created_at: 'x', usage_date: '2026-10-05', fuel_used_l: '12.300' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(record, 201))
      .mockResolvedValueOnce(json(record, 200, { ETag: '"tag-2"' }));
    vi.stubGlobal('fetch', fetchMock);
    const saved = await writeDaily('fuel-usage', 'v1', '2026-10-05', { fuel_used_l: '12.300' }, null);
    const put = call(fetchMock, 0);
    expect(put.url).toBe('/api/backend/fleet/v1/fuel-usage/2026-10-05');
    expect(put.init.method).toBe('PUT');
    expect(put.headers.get('If-None-Match')).toBe('*');
    expect(put.headers.get('If-Match')).toBeNull();
    expect(put.headers.get('X-Waypoint-Client')).toBe('web');
    expect(put.init.body).toBe('{"fuel_used_l":"12.300"}');
    expect(saved).toEqual({ record, etag: '"tag-2"' });

    fetchMock.mockReset()
      .mockResolvedValueOnce(json({ ...record, fuel_used_l: '0.000' }))
      .mockResolvedValueOnce(json(record, 200, { ETag: '"tag-3"' }));
    await writeDaily('fuel-usage', 'v1', '2026-10-05', { fuel_used_l: '0.000' }, '"tag-2"');
    expect(call(fetchMock).headers.get('If-Match')).toBe('"tag-2"');
    expect(call(fetchMock).headers.get('If-None-Match')).toBeNull();
  });

  it('reads an unrecorded day as unknown (null) but surfaces other 404s and 412s', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ detail: 'Daily availability not recorded' }, 404));
    vi.stubGlobal('fetch', fetchMock);
    expect(await readDaily('availability', 'v1', '2026-10-05')).toBeNull();

    fetchMock.mockResolvedValueOnce(json({ detail: 'Vehicle not found' }, 404));
    await expect(readDaily('availability', 'v1', '2026-10-05')).rejects.toMatchObject({ status: 404, detail: 'Vehicle not found' });

    fetchMock.mockResolvedValueOnce(json({ detail: 'Daily input changed; reload it before saving' }, 412));
    await expect(writeDaily('availability', 'v1', '2026-10-05', { is_available: true }, '"old"'))
      .rejects.toMatchObject({ status: 412, detail: 'Daily input changed; reload it before saving' });
  });

  it('opens the existing plan or creates one, and loads it after a concurrent create (409)', async () => {
    const detail = { id: 'p1', depot_id: 'd1', delivery_date: '2026-10-05', status: 'DRAFT', revisions: [] };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ items: [], total: 0, limit: 1, offset: 0 }))
      .mockResolvedValueOnce(json({ detail: 'A plan already exists for this depot and delivery date' }, 409))
      .mockResolvedValueOnce(json({ items: [detail], total: 1, limit: 1, offset: 0 }))
      .mockResolvedValueOnce(json(detail));
    vi.stubGlobal('fetch', fetchMock);
    expect(await openPlan('d1', '2026-10-05')).toEqual({ plan: detail, created: false });
    expect(call(fetchMock, 0).url).toBe('/api/backend/plans?depot_id=d1&delivery_date=2026-10-05&limit=1&offset=0');
    expect(call(fetchMock, 1).body).toEqual({ depot_id: 'd1', delivery_date: '2026-10-05' });
    expect(call(fetchMock, 3).url).toBe('/api/backend/plans/p1');
  });

  it('posts optimization and publication to the plan routes with the revision ID and request ID', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => json({}, 201));
    vi.stubGlobal('fetch', fetchMock);
    const request = buildOptimizeRequest({ requestId: 'req-9', day: '2026-10-05', outletIds: ['o1'], shifts: [], serviceMinutes: 5 });
    await optimizePlan('p1', request);
    expect(call(fetchMock).url).toBe('/api/backend/plans/p1/optimize');
    expect(call(fetchMock).body).toEqual(request);

    await publishRevision('p1', 'rev-2', { request_id: 'pub-1', driver_assignments: [{ trip_id: 't1', driver_id: 'drv' }] });
    const publish = call(fetchMock, 1);
    expect(publish.url).toBe('/api/backend/plans/p1/revisions/rev-2/publish');
    expect(publish.init.method).toBe('POST');
    expect(publish.headers.get('X-Waypoint-Client')).toBe('web');
    expect(publish.body).toEqual({ request_id: 'pub-1', driver_assignments: [{ trip_id: 't1', driver_id: 'drv' }] });
  });

  it('retries an uncertain publish with the same request ID', async () => {
    const keeper = createRequestKeeper();
    const payload = { revision: 'rev-2', assignments: [{ trip_id: 't1', driver_id: 'drv' }] };
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(json({ request_id: 'replayed' }, 200));
    vi.stubGlobal('fetch', fetchMock);
    const send = () => publishRevision('p1', 'rev-2', { request_id: keeper.idFor(payload), driver_assignments: payload.assignments });
    await expect(send()).rejects.toBeInstanceOf(TypeError);
    await send();
    expect(call(fetchMock, 0).body.request_id).toBe(call(fetchMock, 1).body.request_id);
  });

  it('maps unpublished plans and revisions without results to null, not errors', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ detail: 'Plan has not been published' }, 404))
      .mockResolvedValueOnce(json({ detail: 'Optimization result not found' }, 404))
      .mockResolvedValueOnce(json({ detail: 'Plan not found' }, 404));
    vi.stubGlobal('fetch', fetchMock);
    expect(await getPublication('p1')).toBeNull();
    expect(await getResults('p1', 'rev-1')).toBeNull();
    await expect(getResults('p2', 'rev-1')).rejects.toMatchObject({ status: 404, detail: 'Plan not found' });
    expect(call(fetchMock, 1).url).toBe('/api/backend/plans/p1/revisions/rev-1/results');
  });
});
