import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE, GET, POST } from '../app/api/session/route';
import { GET as PROXY_GET, POST as PROXY_POST } from '../app/api/backend/[...path]/route';

afterEach(() => vi.unstubAllGlobals());

const user = { id: 'u1', email: 'store@waypoint.demo', is_active: true, roles: ['STORE_MANAGER'], outlet_ids: ['o1'], depot_ids: [] };
const login = (remember: boolean, headers: Record<string, string> = { 'x-waypoint-client': 'web' }) =>
  new NextRequest('http://localhost:3000/api/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ email: user.email, password: 'pw', remember, role: 'STORE_MANAGER' }),
  });
const withCookie = (url: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
  new NextRequest(url, { ...init, headers: { cookie: 'waypoint_session=issued-token', ...init.headers } });
const params = (path: string[]) => ({ params: Promise.resolve({ path }) });

describe('/api/session', () => {
  it('signs in into an httpOnly SameSite=Strict cookie without returning the token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify(
      { access_token: 'issued-token', token_type: 'bearer', expires_in: 1800, user }))));
    const remembered = await POST(login(true));
    const body = await remembered.json();
    expect(remembered.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain('issued-token');
    const cookie = remembered.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/waypoint_session=issued-token/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=strict/i);
    expect(cookie).toMatch(/Max-Age=1800/);
    expect(cookie).not.toMatch(/Secure/);
    const sessionOnly = await POST(login(false, { 'x-waypoint-client': 'web', 'x-forwarded-proto': 'https' }));
    const secureCookie = sessionOnly.headers.get('set-cookie') ?? '';
    expect(secureCookie).not.toMatch(/Max-Age/);
    expect(secureCookie).toMatch(/Secure/);
  });

  it('rejects cross-site posts and maps failures without setting a cookie', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await POST(login(true, {}))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }));
    const wrongPassword = await POST(login(true));
    expect(wrongPassword.status).toBe(401);
    expect(await wrongPassword.json()).toEqual({ reason: 'invalid-credentials' });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(
      { access_token: 't', token_type: 'bearer', expires_in: 1800, user: { ...user, roles: ['DRIVER'] } })));
    const wrongRole = await POST(login(true));
    expect(wrongRole.status).toBe(403);
    expect(wrongRole.headers.get('set-cookie')).toBeNull();
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect((await POST(login(true))).status).toBe(502);
  });

  it('reports the current user, expiry and sign-out', async () => {
    expect((await GET(new NextRequest('http://localhost:3000/api/session'))).status).toBe(401);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(user))));
    const current = await GET(withCookie('http://localhost:3000/api/session?role=STORE_MANAGER'));
    expect(await current.json()).toEqual({ user });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(user))));
    expect((await GET(withCookie('http://localhost:3000/api/session?role=DISPATCHER'))).status).toBe(403);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('', { status: 401 })));
    const expired = await GET(withCookie('http://localhost:3000/api/session'));
    expect(await expired.json()).toEqual({ reason: 'expired' });
    expect(expired.headers.get('set-cookie')).toMatch(/Max-Age=0/);
    expect((await DELETE(withCookie('http://localhost:3000/api/session', { method: 'DELETE' }))).status).toBe(403);
    const signedOut = await DELETE(withCookie('http://localhost:3000/api/session',
      { method: 'DELETE', headers: { 'x-waypoint-client': 'web' } }));
    expect(signedOut.status).toBe(204);
    expect(signedOut.headers.get('set-cookie')).toMatch(/Max-Age=0/);
  });
});

describe('/api/backend proxy', () => {
  it('adds the bearer token, keeps the API prefix and rewrites Location', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"items":[]}', {
      status: 201, headers: { 'content-type': 'application/json', location: '/api/v1/store/orders/1', 'set-cookie': 'x=1' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await PROXY_POST(withCookie('http://localhost:3000/api/backend/store/orders?limit=5',
      { method: 'POST', headers: { 'x-waypoint-client': 'web', 'content-type': 'application/json' } }), params(['store', 'orders']));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/v1/store/orders?limit=5');
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer issued-token');
    expect(response.headers.get('location')).toBe('/api/backend/store/orders/1');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('rejects unsafe paths, missing sessions and writes without the client header', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    for (const path of [['..', 'docs'], ['store', '.'], ['store', '']]) {
      expect((await PROXY_GET(withCookie('http://localhost:3000/api/backend/x'), params(path))).status).toBe(400);
    }
    expect((await PROXY_GET(new NextRequest('http://localhost:3000/api/backend/me'), params(['me']))).status).toBe(401);
    const write = await PROXY_POST(withCookie('http://localhost:3000/api/backend/store/orders', { method: 'POST' }), params(['store', 'orders']));
    expect(write.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
