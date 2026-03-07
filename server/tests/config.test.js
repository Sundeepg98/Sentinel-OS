const config = require('../lib/config');

describe('System Configuration', () => {
  test('should have all required sections', () => {
    expect(config).toHaveProperty('AI');
    expect(config).toHaveProperty('DB');
    expect(config).toHaveProperty('API');
    expect(config).toHaveProperty('SYSTEM');
  });

  test('should have sane default values', () => {
    expect(config.AI.DEFAULT_MODEL).toBe('gemini-2.5-flash');
    expect(config.API.VERSION).toBe('v1');
    expect(config.DB.RETRY.MAX_ATTEMPTS).toBeGreaterThan(0);
  });
});
