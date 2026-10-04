import type { DeliveryFailureReason, DriverStopResponse, DriverTripDetailResponse } from '@waypoint/api-contracts';
import type { OutboxEvent } from '@waypoint/mobile-sync';

/** Not yet confirmed by the server: saved on this phone (`pending`) or being sent (`syncing`). */
export type LocalState = 'pending' | 'syncing';
export type StopView = DriverStopResponse & { local: LocalState | null };
/** The cached server trip with this phone's unsent events applied on top, oldest first. */
export type TripView = Omit<DriverTripDetailResponse, 'stops'> & { stops: StopView[]; tripLocal: LocalState | null };

export function overlay(server: DriverTripDetailResponse, events: OutboxEvent[]): TripView {
  const trip = { ...server.trip };
  let tripLocal: LocalState | null = null;
  const stops = new Map(server.stops.map((s) => [s.stop_id, { ...s, local: null } as StopView]));
  for (const event of events) {
    if (event.status !== 'pending' && event.status !== 'syncing') continue;
    const state = event.status as LocalState;
    const stop = event.stop_id ? stops.get(event.stop_id) : undefined;
    const at = event.created_at;
    switch (event.type) {
      case 'TRIP_STARTED':
        trip.status = 'IN_PROGRESS';
        tripLocal = state;
        break;
      case 'TRIP_COMPLETED':
        trip.status = 'COMPLETED';
        tripLocal = state;
        break;
      case 'STOP_ARRIVED':
        if (stop) Object.assign(stop, { status: 'ARRIVED', arrived_at: at, local: state });
        break;
      case 'STOP_DELIVERED':
        if (stop) Object.assign(stop, { status: 'DELIVERED', outcome_at: at, local: state });
        break;
      case 'STOP_FAILED': {
        const p = event.payload as { reason_code: DeliveryFailureReason; note: string };
        if (stop) Object.assign(stop, { status: 'FAILED', outcome_at: at, failure_reason: p.reason_code, failure_note: p.note, local: state });
        break;
      }
    }
  }
  return { ...server, trip, stops: server.stops.map((s) => stops.get(s.stop_id)!), tripLocal };
}
