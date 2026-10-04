import type { LoadStatus, TripStatus } from '@waypoint/api-contracts';

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

export const shortId = (id: string) => id.slice(0, 8).toUpperCase();

export const TRIP_LABEL: Record<TripStatus, string> = {
  PLANNED: 'Not started',
  LOADING: 'Loading',
  READY: 'Ready for driver',
  IN_PROGRESS: 'On route',
  COMPLETED: 'Completed',
};

export const LOAD_LABEL: Record<LoadStatus, string> = {
  LOADED: 'Loaded',
  MISSING: 'Missing',
  DAMAGED: 'Damaged',
};

/** Loading can change only before the trip is marked ready. */
export const canLoad = (status: TripStatus) => status === 'PLANNED' || status === 'LOADING';
