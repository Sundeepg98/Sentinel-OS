import { reportError } from './telemetry';

/**
 * 📡 STAFF-LEVEL FRONTEND LOGGER
 * Standardized logging utility with secret redaction and correlation mapping.
 */

const REDACTED_KEYS = ['token', 'secret', 'password', 'key', 'authorization', 'cookie'];

function redact(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;

  const clean: Record<string, unknown> = Array.isArray(obj)
    ? ([...obj] as unknown as Record<string, unknown>)
    : { ...(obj as Record<string, unknown>) };

  for (const key in clean) {
    if (REDACTED_KEYS.some((k) => key.toLowerCase().includes(k))) {
      clean[key] = '***REDACTED***';
    } else if (typeof clean[key] === 'object' && clean[key] !== null) {
      clean[key] = redact(clean[key]);
    }
  }
  return clean;
}

export const logger = {
  info: (message: string, context?: unknown) => {
    console.log(`[INFO] ${message}`, redact(context) || '');
  },
  warn: (message: string, context?: unknown) => {
    console.warn(`[WARN] ${message}`, redact(context) || '');
  },
  error: (message: string, error?: unknown, context?: unknown) => {
    const redactedContext = redact(context);
    console.error(`[ERROR] ${message}`, error, redactedContext || '');

    // Auto-report critical errors to backend telemetry
    if (error instanceof Error) {
      reportError(error, redactedContext ? JSON.stringify(redactedContext) : undefined);
    }
  },
};
