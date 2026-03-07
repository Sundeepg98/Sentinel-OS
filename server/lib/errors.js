/**
 * 🚨 CENTRALIZED ERROR HANDLING (Sentinel-OS)
 * Implements the Staff-level "Standardized Error Envelope" pattern.
 * Distinguishes between Operational (trusted) and Programmatic (bugs) errors.
 */

const ERROR_CODES = {
  BAD_REQUEST: 'SNTL-4000',
  VALIDATION_ERROR: 'SNTL-4001',
  AUTHENTICATION_FAILED: 'SNTL-4002',
  AUTHORIZATION_DENIED: 'SNTL-4003',
  NOT_FOUND: 'SNTL-4004',
  INTERNAL_ERROR: 'SNTL-5000',
  AI_ENGINE_OFFLINE: 'SNTL-5001',
};

class AppError extends Error {
  constructor(message, statusCode = 500, details = null, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = isOperational;

    // Assign error code based on status code if not provided in details
    this.code =
      (details && details.code) ||
      (statusCode === 400
        ? ERROR_CODES.BAD_REQUEST
        : statusCode === 401
          ? ERROR_CODES.AUTHENTICATION_FAILED
          : statusCode === 403
            ? ERROR_CODES.AUTHORIZATION_DENIED
            : statusCode === 404
              ? ERROR_CODES.NOT_FOUND
              : ERROR_CODES.INTERNAL_ERROR);

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(details) {
    super('Invalid Request Payload', 400, { ...details, code: ERROR_CODES.VALIDATION_ERROR }, true);
  }
}

class AuthError extends AppError {
  constructor(message = 'Authentication Failed') {
    super(message, 401, { code: ERROR_CODES.AUTHENTICATION_FAILED }, true);
  }
}

/**
 * Higher-order function to catch async errors and forward them to the global handler.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  AppError,
  ValidationError,
  AuthError,
  asyncHandler,
  ERROR_CODES,
};
