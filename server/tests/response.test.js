const { responseEnvelope } = require('../lib/response');

describe('API Response Standards', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      id: 'test-id',
      headers: {},
      query: {},
      log: { info: jest.fn() },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('should attach success and error methods to res', () => {
    responseEnvelope(req, res, next);
    expect(res.success).toBeDefined();
    expect(res.error).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  test('res.success should return structured JSON', () => {
    responseEnvelope(req, res, next);
    res.success({ foo: 'bar' });

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        data: { foo: 'bar' },
        meta: expect.objectContaining({
          requestId: 'test-id',
        }),
      })
    );
  });

  test('res.error should return structured error JSON', () => {
    responseEnvelope(req, res, next);
    res.error('Mission failed', 400, { code: 'ERR_1' });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'fail',
        error: expect.objectContaining({
          message: 'Mission failed',
          details: { code: 'ERR_1' },
        }),
      })
    );
  });
});
