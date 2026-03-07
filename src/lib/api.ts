/**
 * 🛰️ SHARED API UTILITY
 * Handles JWT injection and error normalization.
 */

export async function fetchWithAuth(url: string, getToken: () => Promise<string | null>, options: RequestInit = {}) {
  const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === 'true';
  const BYPASS_TOKEN = 'sentinel_staff_2026';
  
  // 🛰️ ENGINEERING BASIC: REQUEST CORRELATION
  const correlationId = crypto.randomUUID();
  
  const headers = new Headers(options.headers);
  headers.set('X-Correlation-ID', correlationId);
  
  // 🚀 DEVELOPER BYPASS
  headers.set('x-sentinel-bypass', BYPASS_TOKEN);
  
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

  const performFetch = async (attempt = 1): Promise<any> => {
    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || errorData.error || `HTTP Error: ${response.status}`);
      }

      const result = await response.json();
      
      // Unwrap the standardized API envelope if present
      if (result && result.status === 'success' && 'data' in result) {
        return result.data;
      }
      
      return result;
    } catch (err: any) {
      // 🔄 ENGINEERING BASIC: RETRY LOGIC (GET only, max 2 retries)
      if (options.method === 'GET' || !options.method) {
        if (attempt < 3 && (err.name === 'TypeError' || err.message.includes('Failed to fetch'))) {
          await new Promise(res => setTimeout(res, 1000 * attempt));
          return performFetch(attempt + 1);
        }
      }
      throw err;
    }
  };

  try {
    const data = await performFetch();
    clearTimeout(timeoutId);
    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Technical Intelligence Engine Request Timed Out (10s limit).');
    }
    throw err;
  }
}

export async function reportError(error: Error, componentStack?: string) {
  try {
    const correlationId = crypto.randomUUID(); // New ID for the reporting request itself
    await fetch('/api/v1/admin/error-logs', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Correlation-ID': correlationId
      },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
      }),
    });
  } catch (e) {
    console.error('Failed to report error:', e);
  }
}
