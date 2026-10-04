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
  it('reads an ETag and passes it unchanged for a conditional update', async () => {
    const tag = '"' + 'a'.repeat(64) + '"';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{"is_available":true}', { headers: { ETag: tag } }))
      .mockResolvedValueOnce(new Response('{"is_available":false}'));
    vi.stubGlobal('fetch', fetchMock);
    const client = createApiClient('http://localhost/api/v1', async () => 'test-token');
    const path = '/fleet/vehicle/availability/2026-10-03';
    const current = await client.requestWithMetadata<{ is_available: boolean }>(path);
    expect(current).toEqual({ data: { is_available: true }, status: 200, etag: tag, location: null });
    const saved = await client.requestWithMetadata(path, {
      method: 'PUT', headers: { 'If-Match': current.etag! }, body: JSON.stringify({ is_available: false }),
    });
    expect(saved.etag).toBeNull(); // GET again for the representation's next validator.
    const headers = fetchMock.mock.calls[1][1].headers as Headers;
    expect(headers.get('If-Match')).toBe(tag);
    expect(headers.get('Authorization')).toBe('Bearer test-token');
    expect(headers.get('Content-Type')).toBe('application/json');
  });
  it('exposes creation metadata without inventing a validator', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"fuel_used_l":"0.000"}', {
      status: 201, headers: { Location: '/api/v1/fleet/vehicle/fuel-usage/2026-10-03' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await createApiClient('http://localhost').requestWithMetadata('/fuel', {
      method: 'PUT', headers: { 'If-None-Match': '*' }, body: '{"fuel_used_l":"0"}',
    });
    expect(result).toEqual({ data: { fuel_used_l: '0.000' }, status: 201, etag: null,
      location: '/api/v1/fleet/vehicle/fuel-usage/2026-10-03' });
    expect((fetchMock.mock.calls[0][1].headers as Headers).get('If-None-Match')).toBe('*');
  });
  it('keeps precondition failures visible for reload and review', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 412 })));
    await expect(createApiClient('http://localhost').requestWithMetadata('/fuel'))
      .rejects.toMatchObject({ status: 412, name: 'ApiError' });
  });
  it('returns metadata for empty responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    expect(await createApiClient('http://localhost').requestWithMetadata('/event'))
      .toEqual({ data: undefined, status: 204, etag: null, location: null });
  });
});
