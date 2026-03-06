const { truncateToBudget } = require('../lib/intelligence');

describe('Intelligence Engine Logic', () => {
  test('truncateToBudget should respect character limits', () => {
    const text = "A".repeat(100);
    const result = truncateToBudget(text, 50);
    expect(result).toHaveLength(50 + "... [Truncated for Token Budget]".length);
    expect(result).toMatch(/Truncated/);
  });

  test('truncateToBudget should return short text as-is', () => {
    const text = "Safe text";
    const result = truncateToBudget(text, 100);
    expect(result).toBe("Safe text");
  });
});
