const { validateBody } = require('../lib/validation');
const { ValidationError } = require('../lib/errors');
const { z } = require('zod');

describe('Validation Middleware', () => {
  let req, res, next;
  const schema = z.object({
    foo: z.string().min(3)
  });

  beforeEach(() => {
    req = { body: {} };
    res = {
      error: jest.fn()
    };
    next = jest.fn();
  });

  test('should call next() if body is valid', () => {
    req.body = { foo: 'valid' };
    const middleware = validateBody(schema);
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.error).not.toHaveBeenCalled();
  });

  test('should call next(ValidationError) if body is invalid', () => {
    req.body = { foo: 'sh' }; // Too short
    const middleware = validateBody(schema);
    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    expect(res.error).not.toHaveBeenCalled();
  });
});
