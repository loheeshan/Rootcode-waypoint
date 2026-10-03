import type { Role } from '@waypoint/shared-types';

export type { Role, OrderStatus, TripStatus, SyncStatus } from '@waypoint/shared-types';
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
