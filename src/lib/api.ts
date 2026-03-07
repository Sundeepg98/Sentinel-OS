/**
 * 🛰️ SHARED API UTILITY
 * Handles JWT injection, correlation IDs, error normalization, and resilience.
 */

import { env, APP_VERSION, API_BASE } from './env';

export async function fetchWithAuth<T = unknown>(
  url: string,
  getToken: () => Promise<string | null>,
  options: RequestInit = {}
): Promise<T> {
  const AUTH_ENABLED = env.VITE_AUTH_ENABLED;
  const correlationId = crypto.randomUUID();

  // 🛡️ STAFF BASIC: Normalize URL by prepending API_BASE if needed
  const fullUrl = url.startsWith('http')
    ? url
    : `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;

  const headers = new Headers(options.headers);
  headers.set('X-Correlation-ID', correlationId);
  headers.set('x-sentinel-bypass', env.VITE_DEV_BYPASS_TOKEN); // Staff bypass for intelligence access

  if (AUTH_ENABLED) {
    const token = await getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  // Ensure JSON content type for POST requests
  if (options.method === 'POST' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // --- 🛡️ ENGINEERING BASIC: REQUEST TIMEOUT & SIGNAL COMPOSITION ---
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s Timeout

  // If the caller provided a signal, link it to our controller
  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  const performFetch = async (attempt = 1): Promise<T> => {
    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error?.message || errorData.error || `HTTP Error: ${response.status}`
        );
      }

      const result = await response.json();

      // 🛡️ ENGINEERING BASIC: VERSION PARITY CHECK
      if (result.meta?.version && result.meta.version !== APP_VERSION) {
        console.warn(
          `📡 [Version Mismatch] Client: ${APP_VERSION} | Server: ${result.meta.version}. A reload may be required.`
        );
      }

      // Unwrap the standardized API envelope if present
      if (result && result.status === 'success' && 'data' in result) {
        return result.data as T;
      }

      return result as T;
    } catch (err: unknown) {
      // 🔄 ENGINEERING BASIC: UNIVERSAL RETRY LOGIC (Max 2 retries)
      // Safe because backend implements Idempotency via Correlation ID
      const message = err instanceof Error ? err.message : String(err);
      const name = err instanceof Error ? err.name : '';

      if (
        attempt < 3 &&
        (name === 'TypeError' ||
          message.includes('Failed to fetch') ||
          message.includes('Load failed'))
      ) {
        const delay = 1000 * attempt;
        await new Promise((res) => setTimeout(res, delay));
        return performFetch(attempt + 1);
      }
      throw err;
    }
  };

  try {
    const data = await performFetch();
    clearTimeout(timeoutId);
    return data;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Technical Intelligence Engine Request Timed Out (10s limit).');
    }
    throw err;
  }
}
