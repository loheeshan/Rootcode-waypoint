import type { LoadStatus, LoadingOrderResponse, LoadingStopResponse, TripLoadingResponse } from '@waypoint/api-contracts';
import type { OutboxEvent } from '@waypoint/mobile-sync';

/** Not yet confirmed by the server: saved on this phone (`pending`) or being sent (`syncing`). */
export type LocalState = 'pending' | 'syncing';
export type OrderView = LoadingOrderResponse & { local: LocalState | null };
export type StopView = Omit<LoadingStopResponse, 'orders'> & { orders: OrderView[] };
/** The cached server view with this phone's unsent load events applied on top. */
export type TripView = Omit<TripLoadingResponse, 'stops'> & { stops: StopView[] };

/**
 * Apply load events over the server copy, oldest first: unsent ones (pending/syncing), and accepted ones
 * newer than the copy (so a failed refresh never makes the checklist go backwards). Failed ones are not applied.
 */
export function overlay(server: TripLoadingResponse, events: OutboxEvent[], fetchedAt: string | null = null): TripView {
  const local = new Map<string, { status: LoadStatus; note: string | null; state: LocalState | null }>();
  for (const event of events) {
    if (event.type !== 'LOAD_RECORDED' || event.status === 'failed') continue;
    if (event.status === 'synced' && (!fetchedAt || event.updated_at <= fetchedAt)) continue;
    const payload = event.payload as { order_id: string; status: LoadStatus; note: string | null };
    local.set(payload.order_id, { status: payload.status, note: payload.note, state: event.status === 'synced' ? null : event.status as LocalState });
  }
  const stops = server.stops.map((stop) => ({
    ...stop,
    orders: stop.orders.map((order): OrderView => {
      const mine = local.get(order.order_id);
      return mine ? { ...order, load_status: mine.status, note: mine.note, local: mine.state } : { ...order, local: null };
    }),
  }));
  const all = stops.flatMap((s) => s.orders);
  const count = (status: LoadStatus) => all.filter((o) => o.load_status === status).length;
  return {
    ...server,
    stops,
    loaded_count: count('LOADED'),
    missing_count: count('MISSING'),
    damaged_count: count('DAMAGED'),
    pending_count: all.filter((o) => !o.load_status).length,
  };
}
