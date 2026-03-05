/**
 * 🛰️ SHARED API UTILITY
 * Handles JWT injection and error normalization.
 */

export async function fetchWithAuth(url: string, getToken: () => Promise<string | null>, options: RequestInit = {}) {
  const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === 'true';
  
  const headers = new Headers(options.headers);
  
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
    throw new Error(errorData.error || `HTTP Error: ${response.status}`);
  }

  return response.json();
}
