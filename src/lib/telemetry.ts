import { API_BASE } from './env';

/**
 * 🛰️ GLOBAL TELEMETRY UTILITY
 * Decoupled from the main API client to prevent circular dependencies.
 */

export async function reportError(error: Error, componentStack?: string) {
  const errorData = {
    id: crypto.randomUUID(),
    message: error.message,
    stack: error.stack,
    componentStack,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    metadata: {
      userAgent: navigator.userAgent,
      platform: (navigator as unknown as { platform: string }).platform,
      language: navigator.language,
      screen: `${window.screen.width}x${window.screen.height}`,
    },
  };

  try {
    const correlationId = crypto.randomUUID();
    await fetch(`${API_BASE}/admin/error-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': correlationId,
      },
      body: JSON.stringify(errorData),
    });

    // 🛡️ STAFF BASIC: On success, try to flush any queued offline errors
    const queueRaw = window.localStorage.getItem('sentinel_error_queue');
    const queue = queueRaw ? JSON.parse(queueRaw) : [];

    if (queue.length > 0) {
      window.localStorage.removeItem('sentinel_error_queue');
      // Process queue sequentially to maintain order and avoid blast
      for (const oldError of queue) {
        await reportError(new Error(oldError.message), oldError.componentStack);
      }
    }
  } catch (e: unknown) {
    // 🛡️ STAFF BASIC: Persistence if offline
    try {
      const queueRaw = window.localStorage.getItem('sentinel_error_queue');
      const queue = queueRaw ? JSON.parse(queueRaw) : [];

      if (queue.length < 50) {
        queue.push(errorData);
        window.localStorage.setItem('sentinel_error_queue', JSON.stringify(queue));
      }
    } catch {
      /* Storage Full */
    }
    console.error('Failed to report error (queued for retry):', e);
  }
}
