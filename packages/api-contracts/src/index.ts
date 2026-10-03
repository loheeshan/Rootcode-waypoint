import type { OrderStatus, Role } from '@waypoint/shared-types';

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
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = 'ApiError'; }
}
/** Tokens are provided by the caller; this module never stores credentials. */
export function createApiClient(baseUrl: string, getToken?: () => Promise<string | null>) {
  const base = baseUrl.replace(/\/$/, '');
  return {
    async request<T>(path: string, init: RequestInit = {}): Promise<T> {
      if (!path.startsWith('/') || path.startsWith('//')) throw new Error('API paths must start with a single slash');
      const headers = new Headers(init.headers);
      const token = await getToken?.();
      if (token) headers.set('Authorization', 'Bearer ' + token);
      if (typeof init.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
      const response = await fetch(base + path, { ...init, headers });
      if (!response.ok) throw new ApiError(response.status, 'API request failed (' + response.status + ')');
      if (response.status === 204) return undefined as T;
      return response.json() as Promise<T>;
    },
  };
}
