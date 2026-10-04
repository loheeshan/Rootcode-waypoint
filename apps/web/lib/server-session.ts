import type { NextRequest } from 'next/server';

/** The bearer token lives only in this httpOnly cookie; browser scripts never see it. */
export const SESSION_COOKIE = 'waypoint_session';

/** Server-side API base (Docker service name in Compose), falling back to the public URL. */
export function apiBase(): string {
  return (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');
}

export function sessionToken(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE)?.value ?? null;
}

/** Writes from this app carry this header; with SameSite=Strict it blocks cross-site requests. */
export const CLIENT_HEADER = 'x-waypoint-client';

export function fromThisApp(request: NextRequest): boolean {
  return request.headers.get(CLIENT_HEADER) === 'web';
}

/** HTTPS directly, behind a TLS-terminating proxy, or forced with SESSION_COOKIE_SECURE=true. */
function isSecure(request: NextRequest): boolean {
  return request.nextUrl.protocol === 'https:'
    || request.headers.get('x-forwarded-proto')?.split(',')[0].trim() === 'https'
    || process.env.SESSION_COOKIE_SECURE === 'true';
}

export function cookieOptions(request: NextRequest, maxAge?: number) {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: isSecure(request),
    path: '/',
    ...(maxAge === undefined ? {} : { maxAge }),
  };
}
