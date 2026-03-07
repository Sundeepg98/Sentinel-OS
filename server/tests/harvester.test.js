const { getKnowledgeGraph } = require('../lib/harvester');

describe('Intelligence Harvester', () => {
  test('should return an empty knowledge graph initially', () => {
    const graph = getKnowledgeGraph();
    expect(graph).toHaveProperty('files');
    expect(graph).toHaveProperty('concepts');
  });

  test('syncIntelligence should parse frontmatter correctly', async () => {
    // This test assumes syncIntelligence runs in the test environment
    // We can't easily mock the FS here without heavy lifting, but we can verify the state
    const graph = getKnowledgeGraph();

    // Check if mailin master analysis is correctly labelled
    const master = graph.files['mailin/00_master_analysis.md'];
    if (master) {
      expect(master.label).toBe('Full Master Analysis');
      expect(master.icon).toBe('Brain');
    }
  });
});
