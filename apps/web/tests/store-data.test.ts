import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  confirmReceipt, countByStatus, createOrder, formatDate, listOrders, stageIndex, suggestedDeliveryDate, validQuantity,
} from '../features/store/data/store';

afterEach(() => vi.unstubAllGlobals());

describe('Store view helpers', () => {
  it('suggests the next date using the 16:00 Colombo cutoff', () => {
    // 15:59 and 16:00 in Colombo (UTC+05:30) on 4 October 2026.
    expect(suggestedDeliveryDate(new Date('2026-10-04T10:29:00Z'))).toBe('2026-10-05');
    expect(suggestedDeliveryDate(new Date('2026-10-04T10:30:00Z'))).toBe('2026-10-06');
    // 00:30 Colombo is still the previous UTC day.
    expect(suggestedDeliveryDate(new Date('2026-10-04T19:00:00Z'))).toBe('2026-10-06');
  });

  it('accepts only positive quantities with up to three decimals', () => {
    for (const ok of ['1', '125.5', '0.875', '999999999.999']) expect(validQuantity(ok)).toBe(true);
    for (const bad of ['', '0', '0.000', '-1', '1.2345', 'abc', '1e3', '1000000000']) expect(validQuantity(bad)).toBe(false);
  });

  it('formats calendar dates without shifting the day and orders the timeline', () => {
    expect(formatDate('2026-10-05')).toBe('Monday 5 October');
    expect(stageIndex('CONFIRMED')).toBe(0);
    expect(stageIndex('RECEIPT_CONFIRMED')).toBe(5);
    expect(stageIndex('DEFERRED')).toBe(-1);
  });
});

describe('Store API calls', () => {
  it('uses the session proxy with the client header and server-owned fields only', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ items: [], total: 3, limit: 1, offset: 0 })));
    vi.stubGlobal('fetch', fetchMock);
    await listOrders({ status: 'DELIVERED', limit: 5, offset: 10 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/backend/store/orders?status=DELIVERED&limit=5&offset=10');
    expect((init.headers as Headers).get('X-Waypoint-Client')).toBe('web');
    expect(Object.values(await countByStatus())).toEqual(Array(7).fill(3));

    fetchMock.mockClear();
    await createOrder({ outlet_id: 'o1', requested_delivery_date: '2026-10-06', temperature_requirement: 'chilled', order_weight_kg: '12.5', order_volume_m3: '0.4' });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/backend/store/orders');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      outlet_id: 'o1', requested_delivery_date: '2026-10-06', temperature_requirement: 'chilled', order_weight_kg: '12.5', order_volume_m3: '0.4',
    });

    fetchMock.mockClear();
    await confirmReceipt('order/1', 'request-1');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/backend/store/orders/order%2F1/receipt');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ request_id: 'request-1' });
  });
});
