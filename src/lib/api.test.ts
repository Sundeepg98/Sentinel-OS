import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchWithAuth } from './api';

describe('fetchWithAuth utility', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('crypto', {
      randomUUID: () => 'test-uuid'
    });
  });

  it('injects correlation ID and bypass token into headers', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success', data: { ok: true } })
    } as Response);

    await fetchWithAuth('/test', async () => 'token');

    const lastCall = mockFetch.mock.calls[0];
    const headers = lastCall[1]?.headers as Headers;
    
    expect(headers.get('X-Correlation-ID')).toBe('test-uuid');
    expect(headers.get('x-sentinel-bypass')).toBe('sentinel_staff_2026');
  });

  it('unwraps success envelope correctly', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success', data: { result: 'val' } })
    } as Response);

    const result = await fetchWithAuth('/test', async () => 'token');
    expect(result).toEqual({ result: 'val' });
  });

  it('handles JSend failure state properly', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ status: 'fail', error: { message: 'Invalid ID' } })
    } as Response);

    await expect(fetchWithAuth('/test', async () => 'token'))
      .rejects.toThrow('Invalid ID');
  });
});
