const pino = require('pino');

/**
 * 📡 CENTRALIZED STRUCTURED LOGGER
 * Standardized logging for all Sentinel-OS backend services.
 * Includes automated secret redaction and environment-aware formatting.
 */
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization', 
      'req.headers.cookie', 
      'res.headers["set-cookie"]', 
      'apiKey', 
      'password', 
      'token',
      'secret'
    ],
    censor: '***REDACTED***'
  },
  transport: process.env.NODE_ENV !== 'production' ? { 
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname'
    }
  } : undefined
});

module.exports = logger;
