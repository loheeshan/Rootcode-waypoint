import { ApiError, createApiClient } from '@waypoint/api-contracts';
import { session } from './session';

export function apiUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) throw new Error('Set EXPO_PUBLIC_API_URL in this app’s .env file');
  return url;
}

let onUnauthorized: (() => void) | null = null;
/** AuthProvider registers its sign-out here so any 401 ends the session consistently. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export function getApiClient() {
  const client = createApiClient(apiUrl(), session.getToken);
  const guard = async <T>(call: (token: string | null) => Promise<T>): Promise<T> => {
    const token = await session.getToken();
    try {
      return await call(token);
    } catch (error) {
      // Only end the session if the rejected token is still current (not a newer sign-in).
      if (error instanceof ApiError && error.status === 401 && (await session.getToken()) === token) {
        onUnauthorized?.();
      }
      throw error;
    }
  };
  return {
    requestWithMetadata: <T>(path: string, init?: RequestInit) =>
      guard(() => client.requestWithMetadata<T>(path, init)),
    request: <T>(path: string, init?: RequestInit) => guard(() => client.request<T>(path, init)),
  };
}
