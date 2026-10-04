import { NextResponse, type NextRequest } from 'next/server';
import { apiBase, fromThisApp, sessionToken } from '../../../../lib/server-session';

/**
 * Same-origin proxy to FastAPI that adds the bearer token from the httpOnly cookie.
 * Writes require the X-Waypoint-Client header; with SameSite=Strict this blocks CSRF.
 * The API still performs all role and scope checks.
 */
const SAFE = new Set(['GET', 'HEAD']);
const FORWARD_REQUEST = ['content-type', 'if-match', 'if-none-match'];
const FORWARD_RESPONSE = ['content-type', 'etag', 'location', 'cache-control', 'x-content-type-options', 'content-disposition'];

async function proxy(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  // Keep every request under the API prefix: no dot or empty segments.
  if (path.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return NextResponse.json({ detail: 'Invalid path' }, { status: 400 });
  }
  if (!SAFE.has(request.method) && !fromThisApp(request)) {
    return NextResponse.json({ detail: 'Missing client header' }, { status: 403 });
  }
  const token = sessionToken(request);
  if (!token) return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
  const headers = new Headers({ Authorization: 'Bearer ' + token });
  for (const name of FORWARD_REQUEST) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const target = apiBase() + '/' + path.map(encodeURIComponent).join('/') + request.nextUrl.search;
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: SAFE.has(request.method) ? undefined : await request.arrayBuffer(),
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch {
    return NextResponse.json({ detail: 'API unreachable' }, { status: 502 });
  }
  const responseHeaders = new Headers();
  for (const name of FORWARD_RESPONSE) {
    const value = upstream.headers.get(name);
    // API Location headers are /api/v1 paths; expose them under this proxy.
    if (value) responseHeaders.set(name, name === 'location' ? value.replace(/^\/api\/v1/, '/api/backend') : value);
  }
  return new NextResponse(upstream.status === 204 ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
