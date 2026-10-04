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

// A request with no answer by then is treated as a connection failure (fetch has no default timeout).
// Large bodies (a proof-of-delivery photo) get longer on slow mobile networks.
const REQUEST_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 90_000;

async function withTimeout<T>(init: RequestInit | undefined, run: (init: RequestInit) => Promise<T>): Promise<T> {
  if (init?.signal) return run(init);
  const controller = new AbortController();
  const large = typeof init?.body === 'string' && init.body.length > 100_000;
  const timer = setTimeout(() => controller.abort(), large ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
  try {
    return await run({ ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function getApiClient() {
  const client = createApiClient(apiUrl(), session.getToken);
  const guard = async <T>(call: (token: string | null) => Promise<T>): Promise<T> => {
    const token = await session.getToken();
    try {
      return await call(token);
    } catch (error) {
      // End the session only if a token was sent and is still current (not signed out or replaced).
      if (error instanceof ApiError && error.status === 401 && token && (await session.getToken()) === token) {
        onUnauthorized?.();
      }
      throw error;
    }
  };
  return {
    requestWithMetadata: <T>(path: string, init?: RequestInit) =>
      guard(() => withTimeout(init, (timed) => client.requestWithMetadata<T>(path, timed))),
    request: <T>(path: string, init?: RequestInit) => guard(() => withTimeout(init, (timed) => client.request<T>(path, timed))),
  };
}
