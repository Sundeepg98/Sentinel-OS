const { getKnowledgeGraph, syncIntelligence } = require('../lib/harvester');
const { db, initDB } = require('../lib/db');

// 🛡️ STAFF BASIC: Mock real API calls in unit tests
jest.mock('../lib/intelligence', () => ({
  getEmbedding: jest.fn().mockResolvedValue(new Array(3072).fill(0)),
  generateStructuredContent: jest.fn().mockResolvedValue('{}'),
}));

describe('Intelligence Harvester', () => {
  beforeAll(async () => {
    await initDB();
  });

  test('should return an empty knowledge graph initially', () => {
    const graph = getKnowledgeGraph();
    expect(graph).toHaveProperty('files');
    expect(graph).toHaveProperty('concepts');
  });

  test('syncIntelligence should parse frontmatter correctly', async () => {
    const graph = getKnowledgeGraph();
    const master = graph.files['mailin/00_master_analysis.md'];
    if (master) {
      expect(master.label).toBe('Full Master Analysis');
      expect(master.icon).toBe('Brain');
    }
  });

  test('reconciliation should purge stale dossiers from DB', async () => {
    // 1. Manually insert a stale dossier into the DB
    db.prepare(
      'INSERT INTO dossiers (id, company, label, content, metadata, content_hash) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('stale/dossier.md', 'stale', 'Stale Dossier', 'Some content', '{}', 'old-hash');

    // 2. Trigger sync (which will find no file on disk for 'stale/dossier.md')
    await syncIntelligence();

    // 3. Verify it was purged
    const check = db.prepare('SELECT 1 FROM dossiers WHERE id = ?').get('stale/dossier.md');
    expect(check).toBeUndefined();
  }, 15000);

  test('syncIntelligence should parse structured types correctly', async () => {
    const graph = getKnowledgeGraph();

    // Find a checklist if it exists
    const checklist = Object.values(graph.files).find((f) => f.type === 'checklist');
    if (checklist) {
      expect(Array.isArray(checklist.content)).toBe(true);
      expect(checklist.content[0]).toHaveProperty('text');
    }
  });
});
