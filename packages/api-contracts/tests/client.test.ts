import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from '../src/index';
afterEach(() => vi.unstubAllGlobals());
describe('shared API client', () => {
  it('passes the caller token and keeps the API prefix', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"status":"ok"}'));
    vi.stubGlobal('fetch', fetchMock);
    const client = createApiClient('http://localhost:8000/api/v1/', async () => 'test-token');
    expect(await client.request('/health')).toEqual({ status: 'ok' });
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8000/api/v1/health');
    expect((fetchMock.mock.calls[0][1].headers as Headers).get('Authorization')).toBe('Bearer test-token');
  });
  it('preserves HTTP failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    await expect(createApiClient('http://localhost').request('/me')).rejects.toMatchObject({ status: 401, name: 'ApiError' } satisfies Partial<ApiError>);
  });
  it('handles empty successful responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    expect(await createApiClient('http://localhost').request('/event')).toBeUndefined();
  });
  it('rejects absolute and protocol-relative paths', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    for (const path of ['https://example.com', '//example.com']) {
      await expect(createApiClient('http://localhost').request(path)).rejects.toThrow('single slash');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
