/**
 * 📜 API CONTRACT STANDARDIZATION (Sentinel-OS)
 * This middleware injects standard response formatters into the Express response object.
 * Ensures every API response follows a strict { status, data, meta } shape.
 */

const LRUCache = require('lru-cache');

// 🛡️ STAFF BASIC: Idempotency cache to prevent duplicate processing on retries
const idempotencyCache = new LRUCache({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes window
});

const responseEnvelope = (req, res, next) => {
  const start = process.hrtime();
  const correlationId = req.headers['x-correlation-id'];

  // 🛡️ STAFF BASIC: Prevent stale API responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Check Idempotency for non-GET requests
  if (correlationId && req.method !== 'GET' && idempotencyCache.has(correlationId)) {
    const cachedResponse = idempotencyCache.get(correlationId);
    req.log.info({ correlationId }, '♻️ Idempotent Response Served from Cache');
    return res.status(cachedResponse.status).json(cachedResponse.body);
  }

  // Standard Success Formatter
  res.success = (data, statusCode = 200) => {
    const diff = process.hrtime(start);
    const latencyMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);

    const body = {
      status: 'success',
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.id,
        latencyMs,
        version: '2.8.0',
      },
    };

    // 📊 ENGINEERING BASIC: Pagination Metadata
    if (req.query && (req.query.limit || req.query.offset)) {
      body.meta.pagination = {
        limit: req.query.limit,
        offset: req.query.offset,
      };
    }

    // Cache the response if it's a mutating request
    if (correlationId && req.method !== 'GET') {
      idempotencyCache.set(correlationId, { status: statusCode, body });
    }

    res.status(statusCode).json(body);
  };

  // Standard Error Formatter
  res.error = (message, statusCode = 500, details = null) => {
    const diff = process.hrtime(start);
    const latencyMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);

    const body = {
      status: `${statusCode}`.startsWith('4') ? 'fail' : 'error',
      error: {
        message,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.id,
        latencyMs,
        version: '2.8.0',
      },
    };

    // Cache errors too, so we don't re-run failing logic
    if (correlationId && req.method !== 'GET' && statusCode !== 500) {
      idempotencyCache.set(correlationId, { status: statusCode, body });
    }

    res.status(statusCode).json(body);
  };

  next();
};

module.exports = { responseEnvelope };
