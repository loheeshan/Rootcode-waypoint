import { NextResponse, type NextRequest } from 'next/server';
import { SignInError, signIn, type AuthUser, type Role } from '@waypoint/api-contracts';
import { apiBase, cookieOptions, fromThisApp, SESSION_COOKIE, sessionToken } from '../../../lib/server-session';

const ROLES: readonly Role[] = ['STORE_MANAGER', 'DISPATCHER'];
const noStore = { 'Cache-Control': 'no-store' };

function failure(status: number, reason: string) {
  return NextResponse.json({ reason }, { status, headers: noStore });
}

/** Sign in: the API token is placed in an httpOnly SameSite=Strict cookie, never returned. */
export async function POST(request: NextRequest) {
  // Blocks cross-site form posts (login CSRF): only this app sends the header with JSON.
  if (!fromThisApp(request)) return failure(403, 'invalid-request');
  const body = await request.json().catch(() => null) as
    { email?: unknown; password?: unknown; remember?: unknown; role?: unknown } | null;
  if (!body || typeof body.email !== 'string' || typeof body.password !== 'string'
    || !ROLES.includes(body.role as Role)) {
    return failure(422, 'invalid-request');
  }
  try {
    const session = await signIn(apiBase(), body.email, body.password, body.role as Role);
    const response = NextResponse.json({ user: session.user }, { headers: noStore });
    // "Keep me signed in" keeps the cookie across browser restarts until the token expires.
    response.cookies.set(SESSION_COOKIE, session.access_token,
      cookieOptions(request, body.remember === true ? session.expires_in : undefined));
    return response;
  } catch (error) {
    const reason = error instanceof SignInError ? error.reason : 'unavailable';
    const status = { 'invalid-credentials': 401, 'wrong-role': 403, network: 502, unavailable: 503 }[reason];
    return failure(status, reason);
  }
}

/** Current user from GET /me; an expired or revoked token clears the cookie. */
export async function GET(request: NextRequest) {
  const token = sessionToken(request);
  if (!token) return failure(401, 'signed-out');
  const role = request.nextUrl.searchParams.get('role') as Role | null;
  let response: Response;
  try {
    response = await fetch(apiBase() + '/me', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
  } catch {
    return failure(502, 'network');
  }
  if (response.status === 401) {
    const expired = failure(401, 'expired');
    expired.cookies.set(SESSION_COOKIE, '', cookieOptions(request, 0));
    return expired;
  }
  if (response.status === 403) return failure(403, 'wrong-role');
  if (!response.ok) return failure(503, 'unavailable');
  const user = await response.json() as AuthUser;
  if (role && !user.roles.includes(role)) return failure(403, 'wrong-role');
  return NextResponse.json({ user }, { headers: noStore });
}

/** Clears the cookie; the API has no revocation endpoint, so the token expires on schedule. */
export async function DELETE(request: NextRequest) {
  if (!fromThisApp(request)) return failure(403, 'invalid-request');
  const response = new NextResponse(null, { status: 204, headers: noStore });
  response.cookies.set(SESSION_COOKIE, '', cookieOptions(request, 0));
  return response;
}
