import { describe, expect, it } from 'vitest';
import type { TripLoadingResponse } from '@waypoint/api-contracts';
import type { OutboxEvent } from '@waypoint/mobile-sync';

import { overlay } from '../src/features/loading/overlay';

const order = (id: string, load_status: TripLoadingResponse['stops'][number]['orders'][number]['load_status'] = null) => ({
  order_id: id, order_status: 'LOADING', temperature_requirement: 'ambient', order_weight_kg: '1.000', order_volume_m3: '1.000',
  load_status, note: null, last_event_id: null,
}) as TripLoadingResponse['stops'][number]['orders'][number];

const server = {
  trip: { trip_id: 't1', status: 'LOADING' },
  last_event_sequence: 1, loaded_count: 1, missing_count: 0, damaged_count: 0, pending_count: 2, completion: null,
  stops: [{ stop_id: 's1', outlet_id: 'o', sequence_number: 1, status: 'PLANNED', planned_arrival_time: null, orders: [order('a', 'LOADED'), order('b'), order('c')] }],
} as unknown as TripLoadingResponse;

const event = (id: string, orderId: string, status: string, state: OutboxEvent['status'], note: string | null = null) => ({
  event_id: id, type: 'LOAD_RECORDED', trip_id: 't1', payload: { order_id: orderId, status, note }, status: state,
}) as unknown as OutboxEvent;

describe('overlay', () => {
  it('applies unsent events in order and recounts, without touching the server status', () => {
    const view = overlay(server, [
      event('1', 'b', 'LOADED', 'pending'),
      event('2', 'b', 'DAMAGED', 'syncing', 'crushed'),
      event('3', 'c', 'MISSING', 'pending', 'not staged'),
    ]);
    const orders = view.stops[0].orders;
    expect(orders.map((o) => [o.order_id, o.load_status, o.local])).toEqual([['a', 'LOADED', null], ['b', 'DAMAGED', 'syncing'], ['c', 'MISSING', 'pending']]);
    expect(orders[1].note).toBe('crushed');
    expect([view.loaded_count, view.missing_count, view.damaged_count, view.pending_count]).toEqual([1, 1, 1, 0]);
    expect(view.trip.status).toBe('LOADING');
  });

  it('does not apply events the server rejected', () => {
    const view = overlay(server, [event('1', 'b', 'LOADED', 'failed')]);
    expect(view.stops[0].orders[1]).toMatchObject({ load_status: null, local: null });
    expect(view.pending_count).toBe(2);
  });
});

describe('overlay after sync', () => {
  it('keeps accepted events newer than the cached copy, and drops older ones', () => {
    const synced = (at: string) => ({ ...event('9', 'b', 'LOADED', 'synced'), updated_at: at }) as OutboxEvent;
    expect(overlay(server, [synced('2026-10-04T10:05:00Z')], '2026-10-04T10:00:00Z').stops[0].orders[1])
      .toMatchObject({ load_status: 'LOADED', local: null });
    expect(overlay(server, [synced('2026-10-04T09:55:00Z')], '2026-10-04T10:00:00Z').stops[0].orders[1])
      .toMatchObject({ load_status: null, local: null });
  });
});
