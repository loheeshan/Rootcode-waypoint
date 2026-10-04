import type {
  AuditAction, AuditEntity, DeferralReason, DeliveryEventType, DeliveryFailureReason, LoadStatus,
  OperationsExceptionKind, OrderStatus, PlanStatus, Role, StopStatus, SyncEventType, SyncOutcome,
  TripStatus,
} from '@waypoint/shared-types';

export type {
  Role, OrderStatus, TripStatus, PlanStatus, StopStatus, AssignmentOutcome, DeferralReason, LoadStatus,
  DeliveryEventType, DeliveryFailureReason, SyncEventType, SyncOutcome, SyncStatus,
  AuditAction, AuditEntity, OperationsExceptionKind,
} from '@waypoint/shared-types';
export interface HealthResponse { status: 'ok'; service: string; version: string }
export interface LoginRequest { email: string; password: string }
export interface AuthUser {
  id: string;
  email: string;
  is_active: boolean;
  roles: Role[];
  outlet_ids: string[];
  depot_ids: string[];
}
export interface LoginResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: AuthUser;
}
export interface OrderCreateRequest {
  outlet_id: string;
  requested_delivery_date: string;
  temperature_requirement: 'ambient' | 'chilled';
  order_weight_kg: string | number;
  order_volume_m3: string | number;
}
export interface OrderResponse {
  id: string;
  outlet_id: string;
  requested_delivery_date: string;
  temperature_requirement: 'ambient' | 'chilled';
  order_weight_kg: string;
  order_volume_m3: string;
  status: OrderStatus;
  created_at: string;
}
export interface OrderCreateResponse {
  order: OrderResponse;
  submitted_delivery_date: string;
  cutoff_applied: boolean;
}
export interface OrderListResponse {
  items: OrderResponse[];
  total: number;
  limit: number;
  offset: number;
}
export interface DepotResponse {
  id: string;
  name: string;
}
export interface OutletResponse {
  id: string;
  brand: string;
  district: string;
  depot_id: string;
  dock_type: string;
  parking_constraint: 'none' | 'van_only';
  window_open_time: string;
  window_close_time: string;
  mall_window: boolean;
}
export interface VehicleResponse {
  id: string;
  type: 'van' | 'truck';
  temperature_type: 'ambient' | 'reefer';
  weight_cap_kg: string;
  volume_cap_m3: string;
  km_per_l: string;
  weekly_fuel_quota_l: string;
  depot_id: string;
}
export interface FleetListResponse {
  items: VehicleResponse[];
  total: number;
  limit: number;
  offset: number;
  depots: DepotResponse[];
}
export interface AvailabilityWriteRequest { is_available: boolean }
export interface FuelUsageWriteRequest { fuel_used_l: string }
export interface VehicleAvailabilityResponse {
  id: string;
  vehicle_id: string;
  created_at: string;
  availability_date: string;
  is_available: boolean;
}
export interface VehicleFuelUsageResponse {
  id: string;
  vehicle_id: string;
  created_at: string;
  usage_date: string;
  fuel_used_l: string;
}
export interface DispatcherOrderResponse extends OrderResponse {
  outlet: OutletResponse;
  depot: DepotResponse;
}
export interface DispatcherOrderListResponse {
  items: DispatcherOrderResponse[];
  total: number;
  limit: number;
  offset: number;
}
export interface PlanCreateRequest {
  depot_id: string;
  delivery_date: string;
}
export interface PlanResponse {
  id: string;
  depot_id: string;
  delivery_date: string;
  status: PlanStatus;
  created_by: string;
  created_at: string;
}
export interface PlanRevisionResponse {
  id: string;
  revision_number: number;
  status: PlanStatus;
  published_at: string | null;
  trip_count: number;
  served_order_count: number;
  deferred_order_count: number;
  unexplained_deferred_count: number;
}
export interface PlanDetailResponse extends PlanResponse {
  revisions: PlanRevisionResponse[];
}
export interface PlanListResponse {
  items: PlanResponse[];
  total: number;
  limit: number;
  offset: number;
}
export type CompatibilityIssue =
  | 'DEPOT_MISMATCH' | 'TEMPERATURE_MISMATCH' | 'VAN_REQUIRED'
  | 'WEIGHT_CAPACITY' | 'VOLUME_CAPACITY' | 'VEHICLE_UNAVAILABLE' | 'AVAILABILITY_UNKNOWN';
export interface VehicleExclusionResponse {
  vehicle_id: string;
  reasons: CompatibilityIssue[];
}
export interface OrderCompatibilityResponse {
  order: DispatcherOrderResponse;
  candidate_vehicle_ids: string[];
  excluded_vehicles: VehicleExclusionResponse[];
}
export interface CompatibilityVehicleResponse {
  vehicle: VehicleResponse;
  is_available: boolean | null;
}
export interface PlanCompatibilityResponse {
  plan_id: string;
  depot_id: string;
  delivery_date: string;
  is_complete_plan_validation: false;
  items: OrderCompatibilityResponse[];
  vehicles: CompatibilityVehicleResponse[];
  total: number;
  limit: number;
  offset: number;
}
export interface OptimizeRequest {
  request_id: string;
  source: string;
  is_synthetic: boolean;
  services: { outlet_id: string; service_seconds: number }[];
  shifts: {
    vehicle_id: string;
    earliest_departure: string;
    latest_return: string;
    turnaround_seconds: number;
  }[];
  legs: {
    from_outlet_id: string | null;
    to_outlet_id: string | null;
    distance_km: string;
    travel_seconds: number;
  }[];
}
export interface SavedStopResponse {
  id: string;
  outlet_id: string;
  sequence_number: number;
  order_ids: string[];
  arrival_at: string;
  service_start_at: string;
  departure_at: string;
}
export interface SavedTripResponse {
  id: string;
  vehicle_id: string;
  trip_number: number;
  departure_at: string;
  return_at: string;
  distance_km: string;
  fuel_l: string;
  stops: SavedStopResponse[];
}
export interface DeferredOrderResponse {
  order_id: string;
  outlet_id: string;
  reason_code: DeferralReason;
  reason_text: string;
}
export interface OptimizationResponse {
  request_id: string;
  plan_id: string;
  revision_id: string;
  revision_number: number;
  created_at: string;
  source: string;
  is_synthetic: boolean;
  validation: 'VALIDATED_SNAPSHOT';
  publishable: false;
  algorithm: 'capacity_then_bounded_insertion';
  eligible_order_count: number;
  trips: SavedTripResponse[];
  deferrals: DeferredOrderResponse[];
}
export interface PublishRequest {
  request_id: string;
  driver_assignments: { trip_id: string; driver_id: string }[];
}
export interface PublishedTripResponse {
  trip_id: string;
  vehicle_id: string;
  trip_number: number;
  driver_id: string;
  departure_at: string;
  return_at: string;
  fuel_l: string;
}
export interface FuelBalanceResponse {
  vehicle_id: string;
  week_start: string;
  weekly_quota_l: string;
  consumed_l: string;
  reserved_l: string;
  remaining_l: string;
}
export interface PublicationResponse {
  request_id: string;
  plan_id: string;
  revision_id: string;
  revision_number: number;
  published_at: string;
  published_by: string;
  validation: 'REVALIDATED_AT_PUBLISH';
  served_order_count: number;
  deferred_order_count: number;
  trips: PublishedTripResponse[];
  fuel_balances: FuelBalanceResponse[];
}
export interface LoaderTripResponse {
  trip_id: string;
  plan_id: string;
  depot_id: string;
  delivery_date: string;
  vehicle_id: string;
  trip_number: number;
  driver_id: string | null;
  status: TripStatus;
  departure_at: string;
  return_at: string;
  stop_count: number;
  order_count: number;
}
export interface LoaderTripListResponse {
  items: LoaderTripResponse[];
  total: number;
  limit: number;
  offset: number;
}
export interface LoadingOrderResponse {
  order_id: string;
  order_status: OrderStatus;
  temperature_requirement: 'ambient' | 'chilled';
  order_weight_kg: string;
  order_volume_m3: string;
  load_status: LoadStatus | null;
  note: string | null;
  last_event_id: string | null;
}
export interface LoadingStopResponse {
  stop_id: string;
  outlet_id: string;
  sequence_number: number;
  status: StopStatus;
  planned_arrival_time: string | null;
  orders: LoadingOrderResponse[];
}
export interface LoadingCompletionResponse {
  request_id: string;
  last_event_sequence: number;
  loaded_count: number;
  missing_count: number;
  damaged_count: number;
  confirmed_by: string;
  confirmed_at: string;
}
export interface TripLoadingResponse {
  trip: LoaderTripResponse;
  last_event_sequence: number;
  loaded_count: number;
  missing_count: number;
  damaged_count: number;
  pending_count: number;
  stops: LoadingStopResponse[];
  completion: LoadingCompletionResponse | null;
}
/** `note` is required (non-blank, max 500) for MISSING and DAMAGED. Reuse event_id on retry. */
export interface LoadEventRequest {
  event_id: string;
  order_id: string;
  status: LoadStatus;
  note?: string | null;
  occurred_at?: string | null;
}
export interface LoadEventResponse {
  event_id: string;
  trip_id: string;
  stop_id: string;
  order_id: string;
  status: LoadStatus;
  note: string | null;
  sequence_number: number;
  occurred_at: string | null;
  recorded_at: string;
  recorded_by: string;
  trip_status: TripStatus;
}
export interface TripReadyRequest {
  request_id: string;
  last_event_sequence: number;
}
/** Same summary fields as the Loader trip list, filtered to the caller's own trips. */
export type DriverTripResponse = LoaderTripResponse;
export interface DriverTripListResponse {
  items: DriverTripResponse[];
  total: number;
  limit: number;
  offset: number;
}
export interface PodResponse {
  pod_id: string;
  trip_id: string;
  stop_id: string;
  receiver_name: string;
  photo_mime_type: 'image/jpeg' | 'image/png';
  photo_size_bytes: number;
  photo_sha256: string;
  captured_at: string | null;
  uploaded_at: string;
  uploaded_by: string;
}
export interface DriverOrderResponse {
  order_id: string;
  order_status: OrderStatus;
  temperature_requirement: 'ambient' | 'chilled';
  order_weight_kg: string;
  order_volume_m3: string;
  load_status: LoadStatus | null;
  deliverable: boolean;
}
export interface DriverStopResponse {
  stop_id: string;
  outlet_id: string;
  outlet_brand: string;
  outlet_district: string;
  window_open_time: string;
  window_close_time: string;
  sequence_number: number;
  status: StopStatus;
  planned_arrival_time: string | null;
  requires_visit: boolean;
  arrived_at: string | null;
  outcome_at: string | null;
  failure_reason: DeliveryFailureReason | null;
  failure_note: string | null;
  pod: PodResponse | null;
  orders: DriverOrderResponse[];
}
export interface DriverTripDetailResponse {
  trip: DriverTripResponse;
  last_event_sequence: number;
  started_at: string | null;
  completed_at: string | null;
  stops: DriverStopResponse[];
}
/** Body for start, arrive and complete. Keep event_id and the payload unchanged on retry. */
export interface DeliveryEventRequest {
  event_id: string;
  occurred_at?: string | null;
}
export interface DeliverRequest extends DeliveryEventRequest {
  pod_id: string;
}
export interface FailRequest extends DeliveryEventRequest {
  reason_code: DeliveryFailureReason;
  note: string;
}
/** JPEG/PNG up to 1,000,000 bytes, base64 encoded. Upload after arrival, before deliver. */
export interface PodUploadRequest {
  pod_id: string;
  receiver_name: string;
  photo_mime_type: 'image/jpeg' | 'image/png';
  photo_base64: string;
  captured_at?: string | null;
}
export interface DeliveryEventResponse {
  event_id: string;
  trip_id: string;
  stop_id: string | null;
  event_type: DeliveryEventType;
  reason_code: DeliveryFailureReason | null;
  note: string | null;
  pod_id: string | null;
  sequence_number: number;
  occurred_at: string | null;
  recorded_at: string;
  recorded_by: string;
  trip_status: TripStatus;
  stop_status: StopStatus | null;
}
/** Payloads are the matching REST bodies without their ID field (the envelope event_id is used). */
export type SyncEventPayload =
  | { type: 'LOAD_RECORDED'; payload: Omit<LoadEventRequest, 'event_id'> }
  | { type: 'TRIP_READY'; payload: Omit<TripReadyRequest, 'request_id'> }
  | { type: 'TRIP_STARTED' | 'TRIP_COMPLETED' | 'STOP_ARRIVED'; payload: Omit<DeliveryEventRequest, 'event_id'> }
  | { type: 'STOP_DELIVERED'; payload: Omit<DeliverRequest, 'event_id'> }
  | { type: 'STOP_FAILED'; payload: Omit<FailRequest, 'event_id'> };
export type SyncEventRequest = SyncEventPayload & {
  event_id: string;
  trip_id: string;
  /** Required for STOP_* events, omitted otherwise. */
  stop_id?: string;
};
export interface SyncBatchRequest {
  device_id: string;
  /** 1-50 events, oldest first, in the order they were created on the device. */
  events: SyncEventRequest[];
}
export interface SyncEventResult {
  index: number;
  event_id: string | null;
  type: SyncEventType | null;
  trip_id: string | null;
  outcome: SyncOutcome;
  http_status: number;
  detail: string | null;
  /** The domain response (LoadEventResponse, TripLoadingResponse or DeliveryEventResponse). */
  result: Record<string, unknown> | null;
}
export interface SyncBatchResponse {
  device_id: string;
  received_at: string;
  results: SyncEventResult[];
  counts: Record<SyncOutcome, number>;
}
/** Reuse request_id when retrying an uncertain confirmation. */
export interface ReceiptRequest {
  request_id: string;
}
export interface ReceiptResponse {
  request_id: string;
  order_id: string;
  outlet_id: string;
  order_status: OrderStatus;
  delivery_event_id: string;
  delivered_at: string;
  confirmed_by: string;
  confirmed_at: string;
}
export interface LoadingProgress {
  orders: number;
  loaded: number;
  missing: number;
  damaged: number;
  pending: number;
}
export interface DeliveryProgress {
  stops_requiring_visit: number;
  delivered_stops: number;
  failed_stops: number;
  open_stops: number;
  delivered_orders: number;
  receipts_confirmed: number;
}
export interface OperationsTripResponse {
  trip: LoaderTripResponse;
  loading: LoadingProgress;
  delivery: DeliveryProgress;
}
export interface OperationsTripListResponse {
  items: OperationsTripResponse[];
  total: number;
  limit: number;
  offset: number;
}
export interface OperationsSummaryResponse {
  delivery_date: string;
  depot_ids: string[];
  draft_plans: number;
  published_plans: number;
  trips_by_status: Record<TripStatus, number>;
  orders_by_status: Record<OrderStatus, number>;
  loading: LoadingProgress;
  delivery: DeliveryProgress;
  deferred_orders: number;
  receipts_pending: number;
  exceptions: Record<OperationsExceptionKind, number>;
}
export interface OperationsExceptionResponse {
  kind: OperationsExceptionKind;
  /** PENDING is outstanding work (a receipt); FAILURE is an actual problem. */
  severity: 'FAILURE' | 'PENDING';
  depot_id: string;
  delivery_date: string;
  trip_id: string;
  stop_id: string | null;
  outlet_id: string | null;
  order_ids: string[];
  occurred_at: string;
  actor_id: string | null;
  reason_code: string | null;
  note: string | null;
  source_id: string;
}
export interface OperationsExceptionListResponse {
  items: OperationsExceptionResponse[];
  total: number;
  limit: number;
  offset: number;
}
export interface AuditEventResponse {
  id: string;
  occurred_at: string;
  actor_id: string;
  action: AuditAction;
  entity_type: AuditEntity;
  entity_id: string;
  depot_id: string;
  trip_id: string | null;
  source_id: string;
  details: Record<string, unknown>;
}
export interface AuditListResponse {
  items: AuditEventResponse[];
  total: number;
  limit: number;
  offset: number;
}
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = 'ApiError'; }
}
export interface ApiResponse<T> {
  data: T;
  status: number;
  etag: string | null;
  location: string | null;
}
/** Why a sign-in attempt failed; each needs a different message and next step. */
export type SignInFailure = 'invalid-credentials' | 'wrong-role' | 'unavailable' | 'network';
export class SignInError extends Error {
  constructor(public readonly reason: SignInFailure) { super('Sign-in failed: ' + reason); this.name = 'SignInError'; }
}
export const signInMessages: Record<SignInFailure, string> = {
  'invalid-credentials': 'Email or password is incorrect.',
  'wrong-role': 'This account does not have access to this app.',
  unavailable: 'Sign-in is temporarily unavailable. Try again shortly.',
  network: 'Cannot reach the Waypoint server. Check your connection and try again.',
};
/**
 * POST /auth/login and require `role` in the returned user. The role only restricts which
 * app may use the session; the server still authorizes every request. Stores nothing.
 */
export async function signIn(baseUrl: string, email: string, password: string, role: Role): Promise<LoginResponse> {
  let response: Response;
  try {
    response = await fetch(baseUrl.replace(/\/$/, '') + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password } satisfies LoginRequest),
    });
  } catch {
    throw new SignInError('network');
  }
  if (response.status === 401 || response.status === 422) throw new SignInError('invalid-credentials');
  if (!response.ok) throw new SignInError('unavailable');
  const body = await response.json() as LoginResponse;
  if (!body.user.is_active || !body.user.roles.includes(role)) throw new SignInError('wrong-role');
  return body;
}
/** Tokens are provided by the caller; this module never stores credentials. */
export function createApiClient(baseUrl: string, getToken?: () => Promise<string | null>) {
  const base = baseUrl.replace(/\/$/, '');
  async function requestWithMetadata<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('API paths must start with a single slash');
    const headers = new Headers(init.headers);
    const token = await getToken?.();
    if (token) headers.set('Authorization', 'Bearer ' + token);
    if (typeof init.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetch(base + path, { ...init, headers });
    if (!response.ok) throw new ApiError(response.status, 'API request failed (' + response.status + ')');
    const data = response.status === 204 ? undefined as T : await response.json() as T;
    return { data, status: response.status, etag: response.headers.get('ETag'), location: response.headers.get('Location') };
  }
  return {
    requestWithMetadata,
    async request<T>(path: string, init: RequestInit = {}): Promise<T> {
      return (await requestWithMetadata<T>(path, init)).data;
    },
  };
}
