import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignInError, signIn, signInMessages } from '../src/index';

afterEach(() => vi.unstubAllGlobals());

const user = (roles: string[], active = true) => ({
  access_token: 'issued-token', token_type: 'bearer', expires_in: 1800,
  user: { id: 'u1', email: 'driver@waypoint.demo', is_active: active, roles, outlet_ids: [], depot_ids: ['d1'] },
});

describe('signIn', () => {
  it('posts JSON credentials to the login endpoint once and returns the session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(user(['DRIVER']))));
    vi.stubGlobal('fetch', fetchMock);
    const result = await signIn('http://localhost:8000/api/v1/', 'driver@waypoint.demo', 'secret-value', 'DRIVER');
    expect(result.user.roles).toEqual(['DRIVER']);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/v1/auth/login');
    expect(JSON.parse(init.body)).toEqual({ email: 'driver@waypoint.demo', password: 'secret-value' });
    expect(url).not.toContain('secret-value');
  });

  it.each([
    [new Response('', { status: 401 }), 'invalid-credentials'],
    [new Response('', { status: 422 }), 'invalid-credentials'],
    [new Response('', { status: 503 }), 'unavailable'],
    [new Response(JSON.stringify(user(['LOADER']))), 'wrong-role'],
    [new Response(JSON.stringify(user(['DRIVER'], false))), 'wrong-role'],
  ])('maps responses to distinct failures', async (response, reason) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(signIn('http://api', 'a@b.c', 'pw', 'DRIVER')).rejects.toMatchObject({ reason });
  });

  it('reports a network failure separately', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network request failed')));
    const error = await signIn('http://api', 'a@b.c', 'pw', 'DRIVER').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SignInError);
    expect(signInMessages[(error as SignInError).reason]).toContain('Cannot reach');
  });
});
