const { AppError, ValidationError, asyncHandler } = require('../lib/errors');

describe('Error Architecture', () => {
  describe('AppError', () => {
    test('should set operational flag and status code correctly', () => {
      const err = new AppError('Test error', 400);
      expect(err.message).toBe('Test error');
      expect(err.statusCode).toBe(400);
      expect(err.status).toBe('fail');
      expect(err.isOperational).toBe(true);
    });

    test('should default to 500 status', () => {
      const err = new AppError('Internal failure');
      expect(err.statusCode).toBe(500);
      expect(err.status).toBe('error');
    });
  });

  describe('ValidationError', () => {
    test('should include details in construction', () => {
      const details = [{ field: 'q', message: 'required' }];
      const err = new ValidationError(details);
      expect(err.statusCode).toBe(400);
      expect(err.details).toEqual(details);
    });
  });

  describe('asyncHandler', () => {
    test('should catch async errors and pass to next', async () => {
      const next = jest.fn();
      const error = new Error('Async crash');
      const mockFn = async () => { throw error; };
      
      const handler = asyncHandler(mockFn);
      await handler({}, {}, next);
      
      expect(next).toHaveBeenCalledWith(error);
    });

    test('should call original function with arguments', async () => {
      const req = { val: 1 };
      const res = { val: 2 };
      const next = jest.fn();
      const mockFn = jest.fn().mockResolvedValue(true);
      
      const handler = asyncHandler(mockFn);
      await handler(req, res, next);
      
      expect(mockFn).toHaveBeenCalledWith(req, res, next);
    });
  });
});
