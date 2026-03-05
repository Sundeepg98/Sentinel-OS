const { parsePlaybook, parseChecklist } = require('../lib/parsers');

describe('Intelligence Parsers', () => {
  test('parsePlaybook should correctly extract Q&A with CRLF', () => {
    const content = `## Q: Scaling Node.js\r\nHow to scale?\r\n\r\n### The Trap Response\r\nJust add RAM\r\n\r\n### Why it fails\r\nEvent loop issues\r\n\r\n### Optimal Staff Response\r\nClustering and worker threads`;
    const result = parsePlaybook(content);
    expect(result).toHaveLength(1);
    expect(result[0].q).toBe('Scaling Node.js');
    expect(result[0].trap).toBe('Just add RAM');
    expect(result[0].optimal).toBe('Clustering and worker threads');
  });

  test('parseChecklist should correctly extract tasks', () => {
    const content = `- [x] Implement RAG\n- [ ] Add Auth`;
    const result = parseChecklist(content);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('Implement RAG');
    expect(result[0].done).toBe(true);
    expect(result[1].done).toBe(false);
  });
});
