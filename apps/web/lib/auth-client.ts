import {
  createApiClient,
  SignInError,
  type AuthUser,
  type Role,
  type SignInFailure,
} from '@waypoint/api-contracts';

/** Browser helpers for the same-origin session routes; the token stays in an httpOnly cookie. */
export type SessionCheck =
  | { status: 'signed-in'; user: AuthUser }
  | { status: 'signed-out' | 'expired' | 'wrong-role' | 'unavailable' | 'network' };

export async function webSignIn(email: string, password: string, remember: boolean, role: Role): Promise<AuthUser> {
  let response: Response;
  try {
    response = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Waypoint-Client': 'web' },
      body: JSON.stringify({ email, password, remember, role }),
    });
  } catch {
    throw new SignInError('network');
  }
  const body = await response.json().catch(() => ({})) as { user?: AuthUser; reason?: string };
  if (response.ok && body.user) return body.user;
  const known: SignInFailure[] = ['invalid-credentials', 'wrong-role', 'network', 'unavailable'];
  const reason = body.reason === 'invalid-request' ? 'invalid-credentials' : body.reason;
  throw new SignInError(known.includes(reason as SignInFailure) ? reason as SignInFailure : 'unavailable');
}

export async function currentSession(role: Role): Promise<SessionCheck> {
  try {
    const response = await fetch('/api/session?role=' + role, { cache: 'no-store' });
    const body = await response.json().catch(() => ({})) as { user?: AuthUser; reason?: string };
    if (response.ok && body.user) return { status: 'signed-in', user: body.user };
    if (body.reason === 'expired' || body.reason === 'wrong-role' || body.reason === 'network') {
      return { status: body.reason };
    }
    return { status: response.status === 401 ? 'signed-out' : 'unavailable' };
  } catch {
    return { status: 'network' };
  }
}

export async function webSignOut(): Promise<void> {
  await fetch('/api/session', { method: 'DELETE', headers: { 'X-Waypoint-Client': 'web' } })
    .catch(() => undefined);
}

const client = createApiClient('/api/backend');
/** API calls through the same-origin proxy; the header marks writes as coming from this app. */
export const backend = {
  request<T>(path: string, init: RequestInit = {}): Promise<T> {
    return backend.requestWithMetadata<T>(path, init).then((response) => response.data);
  },
  /** Same as `request`, also returning status, ETag and Location (fleet inputs, replays). */
  requestWithMetadata<T>(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set('X-Waypoint-Client', 'web');
    return client.requestWithMetadata<T>(path, { ...init, headers, credentials: 'same-origin' });
  },
};

/** Development-only convenience; the password is still entered and checked by the API. */
export const DEMO_EMAILS: Partial<Record<Role, string>> =
  process.env.NODE_ENV === 'production' ? {} : {
    STORE_MANAGER: 'store@waypoint.demo',
    DISPATCHER: 'dispatcher@waypoint.demo',
  };

/** Demo account for a sign-in screen, from the server (only the compose demo returns one). */
export async function loadDemoAccount(role: Role): Promise<{ email: string; password: string } | null> {
  try {
    const response = await fetch('/api/demo', { cache: 'no-store' });
    const body = await response.json() as { demo?: boolean; password?: string; accounts?: Partial<Record<Role, string>> };
    const email = body.accounts?.[role];
    return body.demo && body.password && email ? { email, password: body.password } : null;
  } catch {
    return null;
  }
}
