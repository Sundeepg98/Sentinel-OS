const { AppError, ValidationError, AuthError, ERROR_CODES } = require('../lib/errors');

describe('Error Architecture', () => {
  describe('AppError', () => {
    test('should construct with correct properties', () => {
      const msg = 'Test Error';
      const status = 400;
      const details = { field: 'test' };
      const err = new AppError(msg, status, details);

      expect(err.message).toBe(msg);
      expect(err.statusCode).toBe(status);
      expect(err.details).toEqual(details);
      expect(err.status).toBe('fail');
      expect(err.isOperational).toBe(true);
      expect(err.code).toBe(ERROR_CODES.BAD_REQUEST);
    });
  });

  describe('ValidationError', () => {
    test('should include details and correct code', () => {
      const details = [{ field: 'q', message: 'required' }];
      const err = new ValidationError(details);
      expect(err.statusCode).toBe(400);
      expect(err.details).toEqual({ ...details, code: ERROR_CODES.VALIDATION_ERROR });
      expect(err.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });
  });

  describe('AuthError', () => {
    test('should have 401 status and correct code', () => {
      const err = new AuthError();
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe(ERROR_CODES.AUTHENTICATION_FAILED);
    });
  });
});
