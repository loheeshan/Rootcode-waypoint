import type { DeferralReason, OrderStatus, PlanStatus, Role } from '@waypoint/shared-types';

export type {
  Role, OrderStatus, TripStatus, PlanStatus, StopStatus, AssignmentOutcome, DeferralReason, SyncStatus,
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
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = 'ApiError'; }
}
export interface ApiResponse<T> {
  data: T;
  status: number;
  etag: string | null;
  location: string | null;
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
