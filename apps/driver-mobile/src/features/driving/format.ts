import type { DeliveryFailureReason, StopStatus, TripStatus } from '@waypoint/api-contracts';

// Asia/Colombo is UTC+05:30 all year (no daylight saving), so a fixed offset is exact.
const COLOMBO_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');

/** "HH:mm" in Colombo time for an ISO timestamp. */
export function colomboTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + COLOMBO_OFFSET_MS);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Today's date (YYYY-MM-DD) in Colombo. */
export function colomboToday(now = new Date()): string {
  return new Date(now.getTime() + COLOMBO_OFFSET_MS).toISOString().slice(0, 10);
}

/** "HH:mm" from a server time-of-day such as "08:00:00". */
export const clock = (time: string) => time.slice(0, 5);

export const shortId = (id: string) => id.slice(0, 8).toUpperCase();

export const TRIP_LABEL: Record<TripStatus, string> = {
  PLANNED: 'Waiting for loading',
  LOADING: 'Loading in progress',
  READY: 'Ready to start',
  IN_PROGRESS: 'On route',
  COMPLETED: 'Completed',
};

export const STOP_LABEL: Record<StopStatus, string> = {
  PLANNED: 'Not visited',
  ARRIVED: 'Arrived',
  DELIVERED: 'Delivered',
  FAILED: 'Not delivered',
};

/** The backend's failure reasons, in the order the driver sees them. */
export const FAILURE_REASONS: [DeliveryFailureReason, string][] = [
  ['OUTLET_CLOSED', 'Outlet closed'],
  ['RECEIVER_UNAVAILABLE', 'No one to receive'],
  ['ACCESS_BLOCKED', 'Access blocked'],
  ['DELIVERY_REFUSED', 'Delivery refused'],
  ['VEHICLE_ISSUE', 'Vehicle issue'],
  ['OTHER', 'Other'],
];
export const FAILURE_LABEL = Object.fromEntries(FAILURE_REASONS) as Record<DeliveryFailureReason, string>;
