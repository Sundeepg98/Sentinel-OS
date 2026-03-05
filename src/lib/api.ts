/**
 * 🛰️ SHARED API UTILITY
 * Handles JWT injection and error normalization.
 */

export async function fetchWithAuth(url: string, getToken: () => Promise<string | null>, options: RequestInit = {}) {
  const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === 'true';
  const BYPASS_TOKEN = 'sentinel_staff_2026';
  
  const headers = new Headers(options.headers);
  
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

  const response = await fetch(url, {
    ...options,
    headers,
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
  
  // Fallback for endpoints that might not be enveloped yet (like /health)
  return result;
}
