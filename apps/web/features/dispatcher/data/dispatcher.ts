/**
 * Dispatcher data access and view helpers. Every value comes from the Dispatcher API through
 * the same-origin session proxy; nothing here is mocked or stored in the browser.
 * Quantities stay as the API's decimal strings; sums use exact integer thousandths.
 */
import {
  ApiError,
  errorMessage,
  type AuditListResponse,
  type CompatibilityIssue,
  type DeferralReason,
  type DispatcherOrderListResponse,
  type DispatcherOrderResponse,
  type FleetListResponse,
  type OperationsExceptionKind,
  type OperationsExceptionListResponse,
  type OperationsSummaryResponse,
  type OperationsTripListResponse,
  type OptimizationResponse,
  type OptimizeRequest,
  type OrderStatus,
  type PlanCompatibilityResponse,
  type PlanDetailResponse,
  type PlanListResponse,
  type PublicationResponse,
  type PublishRequest,
  type TripStatus,
  type VehicleAvailabilityResponse,
  type VehicleFuelUsageResponse,
  type VehicleResponse,
} from '@waypoint/api-contracts';
import { backend } from '../../../lib/auth-client';

/* ---------- labels ---------- */

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  CONFIRMED: 'Confirmed',
  PLANNED: 'Planned',
  DEFERRED: 'Deferred',
  LOADING: 'Loading',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  RECEIPT_CONFIRMED: 'Receipt confirmed',
};
export const ORDER_STATUSES = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  PLANNED: 'Planned',
  LOADING: 'Loading',
  READY: 'Ready',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
};
export const TRIP_STATUSES = Object.keys(TRIP_STATUS_LABEL) as TripStatus[];

export const DEFERRAL_LABEL: Record<DeferralReason, string> = {
  NO_COMPATIBLE_VEHICLE: 'No compatible vehicle',
  REEFER_CAPACITY_EXHAUSTED: 'Reefer capacity exhausted',
  VAN_CAPACITY_EXHAUSTED: 'Van capacity exhausted',
  WEIGHT_CAPACITY: 'Weight capacity',
  VOLUME_CAPACITY: 'Volume capacity',
  TIME_WINDOW: 'Delivery window',
  FUEL_QUOTA: 'Weekly fuel quota',
  VEHICLE_UNAVAILABLE: 'Vehicle unavailable',
  TRIP_LIMIT: 'Two-trip limit',
};

export const COMPATIBILITY_LABEL: Record<CompatibilityIssue, string> = {
  DEPOT_MISMATCH: 'Other home depot',
  TEMPERATURE_MISMATCH: 'Chilled needs reefer',
  VAN_REQUIRED: 'Van-only outlet',
  WEIGHT_CAPACITY: 'Over weight capacity',
  VOLUME_CAPACITY: 'Over volume capacity',
  VEHICLE_UNAVAILABLE: 'Unavailable',
  AVAILABILITY_UNKNOWN: 'Availability not recorded',
};

export const EXCEPTION_LABEL: Record<OperationsExceptionKind, string> = {
  LOAD_MISSING: 'Missing at loading',
  LOAD_DAMAGED: 'Damaged at loading',
  DELIVERY_FAILED: 'Delivery failed',
  RECEIPT_PENDING: 'Store receipt pending',
  SYNC_CONFLICT: 'Sync conflict',
};
export const EXCEPTION_KINDS = Object.keys(EXCEPTION_LABEL) as OperationsExceptionKind[];

/** Planning rules the server enforces; shown so they stay visible and are never bypassed. */
export const PLANNING_RULES = [
  'Weight capacity per trip',
  'Volume capacity per trip',
  'Chilled orders only on reefer vehicles',
  'Van-only outlets only on vans',
  'Vehicles serve their home depot only',
  'Outlet delivery windows',
  'Weekly fuel quota per vehicle',
  'At most 2 trips per vehicle per day',
  'Every order is served or deferred with a reason',
];

/* ---------- formatting ---------- */

/** Server UUIDs are long; show a recognisable prefix while the full ID stays in the data. */
export const shortId = (id: string) => id.slice(0, 8).toUpperCase();
export const vehicleLabel = (v: Pick<VehicleResponse, 'id' | 'type' | 'temperature_type'>) =>
  `${v.temperature_type === 'reefer' ? 'Reefer' : 'Ambient'} ${v.type} · ${shortId(v.id)}`;
export const temperatureLabel = (t: 'ambient' | 'chilled') => (t === 'chilled' ? 'Chilled' : 'Ambient');
/** Outlet window strings are local Colombo clock times ("08:00:00"). */
export const windowLabel = (open: string, close: string) => `${open.slice(0, 5)}–${close.slice(0, 5)}`;

const DATE = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Colombo' });
const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Colombo',
});
/** Calendar dates (YYYY-MM-DD) are Colombo dates; format them without shifting the day. */
export const formatDate = (day: string) => DATE.format(new Date(day + 'T00:00:00Z'));
export const formatTime = (iso: string) => TIME.format(new Date(iso));
export const formatDateTime = (iso: string) => DATE_TIME.format(new Date(iso));

/* ---------- Colombo calendar ---------- */

/** Today's date in Asia/Colombo (the server's planning calendar). */
export function colomboToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(day: string, days: number): string {
  return new Date(Date.parse(day + 'T00:00:00Z') + days * 86_400_000).toISOString().slice(0, 10);
}

/** Monday of the plan week (the weekly fuel quota resets on Mondays). */
export function weekStart(day: string): string {
  const weekday = new Date(day + 'T00:00:00Z').getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

/**
 * Days whose consumed-fuel totals the optimizer and publisher require for an available
 * vehicle: Monday of the plan week through today (none for a wholly future week).
 */
export function requiredFuelDays(planDay: string, today: string): string[] {
  const start = weekStart(planDay);
  const end = [today, addDays(start, 6)].sort()[0];
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

/* ---------- exact decimal strings ---------- */

/** Decimal with at most three fractional digits, as the API validates (no sign or exponent). */
export const DECIMAL = /^\d{1,9}(\.\d{1,3})?$/;
export const validFuel = (value: string) => DECIMAL.test(value.trim());

const toMilli = (value: string): bigint => {
  const [whole, fraction = ''] = value.trim().split('.');
  return BigInt(whole) * 1000n + BigInt((fraction + '000').slice(0, 3));
};
const fromMilli = (milli: bigint): string => `${milli / 1000n}.${(milli % 1000n).toString().padStart(3, '0')}`;

/** Exact sum of three-decimal strings (never through floating point). */
export const sumDecimals = (values: string[]): string => fromMilli(values.reduce((total, v) => total + toMilli(v), 0n));
export const exceeds = (value: string, cap: string) => toMilli(value) > toMilli(cap);

/* ---------- errors and request IDs ---------- */

/** A failure whose outcome is unknown (network or server error): retry with the same request ID. */
export const isUncertain = (error: unknown) => !(error instanceof ApiError) || error.status >= 500;

/** User-facing text for a failed action, using the server's reason when it gave one. */
export function failureMessage(error: unknown, action = 'The request'): string {
  if (!(error instanceof ApiError)) {
    return `Cannot reach Waypoint. ${action} may not have been saved; retrying sends the same request.`;
  }
  if (error.status === 401) return 'Your session has expired. Sign in again.';
  if (error.status === 403) return errorMessage(error, 'This account has no access to this depot.');
  if (error.status === 502) return `Cannot reach the Waypoint API. ${action} may not have been saved; retrying sends the same request.`;
  if (error.status >= 500) return `${errorMessage(error, 'The server is unavailable.')} Retrying sends the same request.`;
  return errorMessage(error, `${action} was rejected.`);
}

export const newRequestId = () => globalThis.crypto.randomUUID();

/**
 * Keeps one request ID per payload until it succeeds, so retrying an uncertain request can
 * only replay it on the server. A changed payload is a new action and gets a new ID.
 */
export function createRequestKeeper(makeId: () => string = newRequestId) {
  let current: { fingerprint: string; id: string } | null = null;
  return {
    idFor(payload: unknown): string {
      const fingerprint = JSON.stringify(payload);
      if (!current || current.fingerprint !== fingerprint) current = { fingerprint, id: makeId() };
      return current.id;
    },
    /** Call after the server confirmed the action; the next action gets a fresh ID. */
    settle() { current = null; },
  };
}

/* ---------- orders and fleet ---------- */

const enc = encodeURIComponent;
function query(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  const text = search.toString();
  return text ? '?' + text : '';
}

export function listOrders(params: {
  depot_id?: string; status?: OrderStatus; requested_delivery_date?: string; limit?: number; offset?: number;
} = {}) {
  return backend.request<DispatcherOrderListResponse>('/dispatcher/orders' + query({ ...params, limit: params.limit ?? 20, offset: params.offset ?? 0 }));
}

/** Every order of a depot/day (all statuses), paging through the server list. */
export async function allOrdersForDay(depotId: string, day: string): Promise<DispatcherOrderResponse[]> {
  const items: DispatcherOrderResponse[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await listOrders({ depot_id: depotId, requested_delivery_date: day, limit: 100, offset });
    items.push(...page.items);
    if (!page.items.length || items.length >= page.total) return items;
  }
}

export const getFleet = (depotId?: string) => backend.request<FleetListResponse>('/fleet' + query({ depot_id: depotId, limit: 100 }));

export type DailyKind = 'availability' | 'fuel-usage';
export type DailyRecord<K extends DailyKind> = K extends 'availability' ? VehicleAvailabilityResponse : VehicleFuelUsageResponse;
/** A recorded daily input with its ETag, or null when that day is not recorded (never a default). */
export type DailyInput<K extends DailyKind> = { record: DailyRecord<K>; etag: string } | null;

const NOT_RECORDED = ['Daily availability not recorded', 'Daily fuel usage not recorded'];
const dailyPath = (kind: DailyKind, vehicleId: string, day: string) => `/fleet/${enc(vehicleId)}/${kind}/${enc(day)}`;

export async function readDaily<K extends DailyKind>(kind: K, vehicleId: string, day: string): Promise<DailyInput<K>> {
  try {
    const response = await backend.requestWithMetadata<DailyRecord<K>>(dailyPath(kind, vehicleId, day));
    if (!response.etag) throw new ApiError(response.status, 'Missing daily input validator', 'The server did not return a version tag; reload.');
    return { record: response.data, etag: response.etag };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404 && NOT_RECORDED.includes(error.detail as string)) return null;
    throw error;
  }
}

/**
 * Creates (If-None-Match: *) or replaces (If-Match: <ETag from GET>) one day's input, then
 * reads it back for the next ETag. A 412 means someone changed it: reload before saving again.
 */
export async function writeDaily<K extends DailyKind>(
  kind: K, vehicleId: string, day: string,
  body: K extends 'availability' ? { is_available: boolean } : { fuel_used_l: string },
  etag: string | null,
): Promise<DailyInput<K>> {
  await backend.requestWithMetadata<DailyRecord<K>>(dailyPath(kind, vehicleId, day), {
    method: 'PUT',
    headers: etag ? { 'If-Match': etag } : { 'If-None-Match': '*' },
    body: JSON.stringify(body),
  });
  return readDaily(kind, vehicleId, day);
}

/* ---------- plans ---------- */

export const listPlans = (params: { depot_id?: string; delivery_date?: string; status?: 'DRAFT' | 'PUBLISHED'; limit?: number; offset?: number } = {}) =>
  backend.request<PlanListResponse>('/plans' + query({ ...params, limit: params.limit ?? 20, offset: params.offset ?? 0 }));

export const getPlan = (planId: string) => backend.request<PlanDetailResponse>('/plans/' + enc(planId));

/** Loads the depot/day workspace, creating it when none exists (one plan per depot and date). */
export async function openPlan(depotId: string, day: string): Promise<{ plan: PlanDetailResponse; created: boolean }> {
  const find = async () => (await listPlans({ depot_id: depotId, delivery_date: day, limit: 1 })).items[0];
  const existing = await find();
  if (existing) return { plan: await getPlan(existing.id), created: false };
  try {
    const plan = await backend.request<PlanDetailResponse>('/plans', {
      method: 'POST', body: JSON.stringify({ depot_id: depotId, delivery_date: day }),
    });
    return { plan, created: true };
  } catch (error) {
    // Created concurrently (or the response was lost): load the existing workspace.
    if (error instanceof ApiError && error.status === 409) {
      const raced = await find();
      if (raced) return { plan: await getPlan(raced.id), created: false };
    }
    throw error;
  }
}

export const getCompatibility = (planId: string, limit = 100, offset = 0) =>
  backend.request<PlanCompatibilityResponse>(`/plans/${enc(planId)}/compatibility` + query({ limit, offset }));

/* ---------- optimization ---------- */

/** Synthetic travel data, labelled as such in the request and the UI (no road data source exists). */
export const SYNTHETIC_SOURCE = 'Synthetic dispatcher travel matrix (not real road data)';
export const SYNTHETIC_TRAVEL = {
  depotKm: '6.000', depotSeconds: 900, outletKm: '3.000', outletSeconds: 600,
} as const;

export type ShiftDraft = { vehicle_id: string; start: string; end: string; turnaroundMinutes: number };
export const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Colombo wall-clock time on the plan date as an offset timestamp (Sri Lanka has no DST). */
export const colomboTimestamp = (day: string, clock: string) => `${day}T${clock}:00+05:30`;

/**
 * Suggested earliest departure: 07:30, or for a same-day plan the next 5 minutes after
 * now + 30 min (the server rejects departures before its current time).
 */
export function defaultShiftStart(day: string, now = new Date()): string {
  if (day !== colomboToday(now)) return '07:30';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(now.getTime() + 30 * 60_000));
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const minute = Math.ceil(Number(parts.find((p) => p.type === 'minute')?.value) / 5) * 5;
  const total = Math.max(7 * 60 + 30, hour * 60 + minute);
  if (total >= 24 * 60) return '23:55';
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function validateShift(shift: ShiftDraft): string | null {
  if (!CLOCK.test(shift.start) || !CLOCK.test(shift.end)) return 'Use HH:MM times.';
  if (shift.end <= shift.start) return 'Latest return must be after the earliest departure.';
  if (!Number.isInteger(shift.turnaroundMinutes) || shift.turnaroundMinutes < 0 || shift.turnaroundMinutes > 600) return 'Turnaround must be 0–600 minutes.';
  return null;
}

/**
 * Complete optimize inputs mapped to the eligible outlets and the vehicles marked available:
 * one service entry per outlet, one shift per available vehicle and every directed
 * depot/outlet leg (null is the depot). Travel times are synthetic and labelled so.
 */
export function buildOptimizeRequest(input: {
  requestId: string; day: string; outletIds: string[]; shifts: ShiftDraft[]; serviceMinutes: number;
}): OptimizeRequest {
  const outlets = [...new Set(input.outletIds)].sort();
  const points: (string | null)[] = [null, ...outlets];
  const legs: OptimizeRequest['legs'] = [];
  for (const from of points) {
    for (const to of points) {
      if (from === to) continue;
      const depot = from === null || to === null;
      legs.push({
        from_outlet_id: from,
        to_outlet_id: to,
        distance_km: depot ? SYNTHETIC_TRAVEL.depotKm : SYNTHETIC_TRAVEL.outletKm,
        travel_seconds: depot ? SYNTHETIC_TRAVEL.depotSeconds : SYNTHETIC_TRAVEL.outletSeconds,
      });
    }
  }
  return {
    request_id: input.requestId,
    source: SYNTHETIC_SOURCE,
    is_synthetic: true,
    services: outlets.map((outlet_id) => ({ outlet_id, service_seconds: input.serviceMinutes * 60 })),
    shifts: input.shifts.map((s) => ({
      vehicle_id: s.vehicle_id,
      earliest_departure: colomboTimestamp(input.day, s.start),
      latest_return: colomboTimestamp(input.day, s.end),
      turnaround_seconds: s.turnaroundMinutes * 60,
    })),
    legs,
  };
}

export const optimizePlan = (planId: string, request: OptimizeRequest) =>
  backend.requestWithMetadata<OptimizationResponse>(`/plans/${enc(planId)}/optimize`, { method: 'POST', body: JSON.stringify(request) });

/** Saved result of an optimized revision, or null for a revision without one (e.g. empty revision 1). */
export async function getResults(planId: string, revisionId: string): Promise<OptimizationResponse | null> {
  try {
    return await backend.request<OptimizationResponse>(`/plans/${enc(planId)}/revisions/${enc(revisionId)}/results`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404 && error.detail === 'Optimization result not found') return null;
    throw error;
  }
}

/* ---------- publication ---------- */

/** The plan's effective publication, or null while it is unpublished. */
export async function getPublication(planId: string): Promise<PublicationResponse | null> {
  try {
    return await backend.request<PublicationResponse>(`/plans/${enc(planId)}/publication`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404 && error.detail === 'Plan has not been published') return null;
    throw error;
  }
}

/** Publishes one saved revision (by its ID); the server revalidates it against current inputs. */
export const publishRevision = (planId: string, revisionId: string, body: PublishRequest) =>
  backend.requestWithMetadata<PublicationResponse>(`/plans/${enc(planId)}/revisions/${enc(revisionId)}/publish`, {
    method: 'POST', body: JSON.stringify(body),
  });

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ---------- live operations and audit ---------- */

type OpsScope = { delivery_date?: string; depot_id?: string };
export const getLive = (scope: OpsScope) => backend.request<OperationsSummaryResponse>('/operations/live' + query(scope));
export const listOperationTrips = (scope: OpsScope & { status?: TripStatus; limit?: number; offset?: number }) =>
  backend.request<OperationsTripListResponse>('/operations/trips' + query({ ...scope, limit: scope.limit ?? 20, offset: scope.offset ?? 0 }));
export const listExceptions = (scope: OpsScope & { kind?: OperationsExceptionKind; limit?: number; offset?: number }) =>
  backend.request<OperationsExceptionListResponse>('/operations/exceptions' + query({ ...scope, limit: scope.limit ?? 20, offset: scope.offset ?? 0 }));
export const listAudit = (params: { depot_id?: string; trip_id?: string; limit?: number; offset?: number }) =>
  backend.request<AuditListResponse>('/operations/audit' + query({ ...params, limit: params.limit ?? 20, offset: params.offset ?? 0 }));
