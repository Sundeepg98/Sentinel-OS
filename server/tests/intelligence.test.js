const { truncateToBudget, recordAiFailure, recordAiSuccess, getCircuitState } = require('../lib/intelligence');

// Mocking dependencies
jest.mock('../lib/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  info: jest.fn()
}));

describe('Intelligence Engine Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset state via recordAiSuccess (internal reset)
    recordAiSuccess();
  });

  describe('truncateToBudget', () => {
    test('should respect character limits', () => {
      const text = "A".repeat(100);
      const result = truncateToBudget(text, 50);
      expect(result).toHaveLength(50 + "... [Truncated for Token Budget]".length);
      expect(result).toMatch(/Truncated/);
    });

    test('should return short text as-is', () => {
      const text = "Safe text";
      const result = truncateToBudget(text, 100);
      expect(result).toBe("Safe text");
    });
  });

  describe('Circuit Breaker', () => {
    test('should transition to OPEN after threshold failures', () => {
      expect(getCircuitState()).toBe('CLOSED');
      
      // Default threshold is 5
      for (let i = 0; i < 5; i++) {
        recordAiFailure();
      }
      
      expect(getCircuitState()).toBe('OPEN');
    });

    test('should reset to CLOSED after recordAiSuccess', () => {
      for (let i = 0; i < 5; i++) {
        recordAiFailure();
      }
      expect(getCircuitState()).toBe('OPEN');
      
      recordAiSuccess();
      expect(getCircuitState()).toBe('CLOSED');
    });
  });
});
