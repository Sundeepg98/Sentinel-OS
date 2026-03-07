const { getKnowledgeGraph } = require('../lib/harvester');

describe('Intelligence Harvester', () => {
  test('should return an empty knowledge graph initially or hydrated graph after sync', () => {
    const graph = getKnowledgeGraph();
    expect(graph).toHaveProperty('files');
    expect(graph).toHaveProperty('concepts');
  });
});
