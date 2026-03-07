/**
 * 🛰️ SENTINEL SYSTEM CONFIGURATION
 * Centralized constants and tuning parameters for the Staff+ Baseline.
 */

const config = {
  AI: {
    DEFAULT_MODEL: 'gemini-2.5-flash',
    EMBEDDING_MODEL: 'gemini-embedding-001',
    CIRCUIT_BREAKER: {
      THRESHOLD: 5,
      COOLDOWN_MS: 30000,
    },
    CONTEXT_BUDGET: 15000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY_MS: 1000,
  },
  DB: {
    SQLITE: {
      CACHE_SIZE: 2000,
      SYNC_MODE: 'NORMAL',
    },
    POSTGRES: {
      POOL_MAX: 20,
      IDLE_TIMEOUT_MS: 30000,
      CONN_TIMEOUT_MS: 2000,
    },
    RETRY: {
      MAX_ATTEMPTS: 5,
      INITIAL_DELAY_MS: 1000,
    },
  },
  API: {
    TIMEOUT_MS: 15000,
    RATE_LIMIT: {
      GLOBAL_WINDOW_MS: 15 * 60 * 1000,
      GLOBAL_MAX: 1000,
      ADMIN_MAX: 50,
      AI_MAX: 15,
    },
  },
};

module.exports = config;
