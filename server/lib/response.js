/**
 * 📜 API CONTRACT STANDARDIZATION (Sentinel-OS)
 * This middleware injects standard response formatters into the Express response object.
 * Ensures every API response follows a strict { status, data, meta } shape.
 */

const responseEnvelope = (req, res, next) => {
  const start = process.hrtime();

  // Standard Success Formatter
  res.success = (data, statusCode = 200) => {
    const diff = process.hrtime(start);
    const latencyMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);

    const meta = {
      timestamp: new Date().toISOString(),
      requestId: req.id,
      latencyMs,
      version: '2.8.0',
    };

    // 📊 ENGINEERING BASIC: Pagination Metadata
    if (req.query && (req.query.limit || req.query.offset)) {
      meta.pagination = {
        limit: parseInt(req.query.limit) || null,
        offset: parseInt(req.query.offset) || 0,
      };
    }

    res.status(statusCode).json({
      status: 'success',
      data: data,
      meta,
    });
  };

  // Standard Error Formatter (JSend compliant)
  res.error = (message, statusCode = 500, details = null) => {
    const diff = process.hrtime(start);
    const latencyMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);

    res.status(statusCode).json({
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
    });
  };

  next();
};

module.exports = { responseEnvelope };
