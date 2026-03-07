const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');
const { Index } = require('flexsearch');
const crypto = require('crypto');
const { z } = require('zod');
const { db, isPostgres } = require('./db');
const logger = require('./logger');
const { getEmbedding } = require('./intelligence');
const { parsePlaybook, parseChecklist } = require('./parsers');

const INTELLIGENCE_DIR = path.join(__dirname, '..', '..', 'intelligence');
let knowledgeGraph = { concepts: {}, files: {} };
let searchIndex = new Index({ preset: 'score', tokenize: 'forward' });

// --- Ã°Å¸â€ºÂ¡Ã¯Â¸Â DATA INTEGRITY SCHEMA ---
const dossierFrontmatterSchema = z.object({
  label: z.string().min(1, 'Missing label frontmatter'),
  type: z.enum(['markdown', 'playbook', 'checklist', 'grid', 'map']).default('markdown'),
  icon: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

function extractKeywords(text) {
  if (!text) return [];
  const clean = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  const words = clean.split(/\s+/).filter((w) => w.length > 4);
  const stopWords = new Set([
    'about',
    'above',
    'after',
    'again',
    'against',
    'could',
    'should',
    'would',
  ]);
  return [...new Set(words.filter((w) => !stopWords.has(w)))].slice(0, 10);
}

function getFileHash(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

function chunkMarkdown(text, size = 1000) {
  const chunks = [];
  let current = '';
  text.split('\n').forEach((line) => {
    if ((current + line).length > size) {
      chunks.push(current.trim());
      current = line + '\n';
    } else {
      current += line + '\n';
    }
  });
  if (current) chunks.push(current.trim());
  return chunks;
}

async function processFileVectors(fileId, content, metadata) {
  const pLimitMod = await import('p-limit');
  const pLimit = pLimitMod.default || pLimitMod.pLimit || pLimitMod;
  const limit = pLimit(5);
  try {
    if (isPostgres) {
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM chunks_metadata WHERE file_id = $1', [fileId]);
        const chunks = chunkMarkdown(content);
        const chunkTasks = chunks.map((chunk) =>
          limit(async () => {
            const vector = await getEmbedding(chunk);
            await client.query(
              'INSERT INTO chunks_metadata (file_id, chunk_text, metadata, embedding) VALUES ($1, $2, $3, $4)',
              [fileId, chunk, JSON.stringify(metadata), JSON.stringify(vector)]
            );
          })
        );
        await Promise.all(chunkTasks);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } else {
      const chunks = chunkMarkdown(content);
      const chunkVectors = [];
      const chunkTasks = chunks.map((chunk) =>
        limit(async () => {
          const vector = await getEmbedding(chunk);
          chunkVectors.push({ chunk, vector });
        })
      );
      await Promise.all(chunkTasks);

      db.transaction(() => {
        const oldChunks = db
          .prepare('SELECT id FROM chunks_metadata WHERE file_id = ?')
          .all(fileId);
        if (oldChunks.length > 0) {
          const oldIds = oldChunks.map((c) => Number(c.id));
          db.prepare(`DELETE FROM vec_chunks WHERE id IN (${oldIds.join(',')})`).run();
          db.prepare(`DELETE FROM chunks_metadata WHERE file_id = ?`).run(fileId);
        }

        for (const { chunk, vector } of chunkVectors) {
          const info = db
            .prepare(`INSERT INTO chunks_metadata (file_id, chunk_text, metadata) VALUES (?, ?, ?)`)
            .run(fileId, chunk, JSON.stringify(metadata));

          const metaId = Number(info.lastInsertRowid);

          // Ã°Å¸â€ºÂ¡Ã¯Â¸Â STAFF BASIC: Let sqlite-vec auto-assign ID and update metadata to link them
          const vecInfo = db
            .prepare(`INSERT INTO vec_chunks (vector) VALUES (?)`)
            .run(new Float32Array(vector));
          const vecId = Number(vecInfo.lastInsertRowid);

          db.prepare(`UPDATE chunks_metadata SET id = ? WHERE id = ?`).run(vecId, metaId);
        }
      })();
    }
  } catch (e) {
    logger.error({ fileId, error: e.message }, 'Ã°Å¸Â§Âµ Vectorization Error');
  }
}

async function syncIntelligence() {
  logger.info({ dir: INTELLIGENCE_DIR }, 'Ã°Å¸â€â€ž Sentinel Intelligence Sync: Scanning...');
  const pLimitMod = await import('p-limit');
  const pLimit = pLimitMod.default || pLimitMod.pLimit || pLimitMod;
  const limit = pLimit(5);
  const newGraph = { concepts: {}, files: {} };
  searchIndex = new Index({ preset: 'score', tokenize: 'forward' });
  const activeFileIds = new Set();

  try {
    const companyFolders = await fs.readdir(INTELLIGENCE_DIR, { withFileTypes: true });
    logger.info({ count: companyFolders.length }, 'ðŸ“‚ [Sync] Found items in intelligence dir');
    const syncTasks = [];

    for (const company of companyFolders.filter((d) => d.isDirectory())) {
      const companyPath = path.join(INTELLIGENCE_DIR, company.name);
      const files = await fs.readdir(companyPath);

      for (const fileName of files.filter((f) => f.endsWith('.md'))) {
        syncTasks.push(
          limit(async () => {
            const filePath = path.join(companyPath, fileName);
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const { content, data } = matter(fileContent);

            const validation = dossierFrontmatterSchema.safeParse(data);
            const validatedData = validation.success
              ? validation.data
              : { label: fileName, type: 'markdown' };
            const fileId = `${company.name}/${fileName}`.toLowerCase();
            activeFileIds.add(fileId);
            const currentHash = getFileHash(fileContent);

            let shouldProcess = true;

            try {
              const cached = db
                .prepare('SELECT content_hash FROM dossiers WHERE id = ?')
                .get(fileId);
              if (cached && cached.content_hash === currentHash) shouldProcess = false;
            } catch (e) {
              logger.warn({ fileId, error: e.message }, 'âš ï¸ [Sync] Hash check error');
            }

            if (shouldProcess) {
              logger.info({ fileId }, 'âš¡ [Sync] Triggering vectorization');
              const label = validatedData.label || fileName;
              const sql = `
              INSERT INTO dossiers (id, company, label, content, metadata, content_hash) 
              VALUES (?, ?, ?, ?, ?, ?) 
              ON CONFLICT(id) DO UPDATE SET 
                content=excluded.content, 
                metadata=excluded.metadata, 
                label=excluded.label, 
                content_hash=excluded.content_hash
            `;
              db.prepare(sql).run(
                fileId,
                company.name,
                label,
                content,
                JSON.stringify(data),
                currentHash
              );
              await processFileVectors(fileId, content, data);
              logger.info({ fileId }, 'âœ… [Sync] Vectorization complete');
            }

            const finalKeywords = extractKeywords(content);

            // 🛡️ STAFF BASIC: Structured Parsing based on Type
            let parsedContent = content;
            if (validatedData.type === 'playbook') {
              parsedContent = parsePlaybook(content);
            } else if (validatedData.type === 'checklist') {
              parsedContent = parseChecklist(content);
            }

            newGraph.files[fileId] = {
              label: validatedData.label || fileName,
              type: validatedData.type || 'markdown',
              icon: validatedData.icon,
              company: company.name,
              keywords: finalKeywords,
              content: parsedContent,
            };
            finalKeywords.forEach((k) => {
              if (!newGraph.concepts[k]) newGraph.concepts[k] = [];
              newGraph.concepts[k].push({ fileId, company: company.name });
            });
            searchIndex.add(fileId, content);
          })
        );
      }
    }

    await Promise.all(syncTasks);

    const cloudDossiers = db
      .prepare('SELECT id, company, label, content, metadata FROM dossiers')
      .all();
    cloudDossiers.forEach((d) => {
      if (!activeFileIds.has(d.id)) {
        const keywords = extractKeywords(d.content);
        const metadata = JSON.parse(d.metadata || '{}');

        let parsedContent = d.content;
        if (metadata.type === 'playbook') {
          parsedContent = parsePlaybook(d.content);
        } else if (metadata.type === 'checklist') {
          parsedContent = parseChecklist(d.content);
        }

        newGraph.files[d.id] = {
          label: d.label,
          company: d.company,
          type: metadata.type || 'markdown',
          icon: metadata.icon,
          keywords,
          content: parsedContent,
        };
        keywords.forEach((k) => {
          if (!newGraph.concepts[k]) newGraph.concepts[k] = [];
          newGraph.concepts[k].push({ fileId: d.id, company: d.company });
        });
        searchIndex.add(d.id, d.content);
      }
    });

    knowledgeGraph = newGraph;
    logger.info(
      {
        files: Object.keys(knowledgeGraph.files).length,
        concepts: Object.keys(knowledgeGraph.concepts).length,
      },
      'Ã¢Å“â€¦ Intelligence Engine ACTIVE.'
    );
  } catch (e) {
    logger.error({ error: e.message }, 'Ã°Å¸Â§Âµ Sync Error');
  }
}

module.exports = {
  syncIntelligence,
  getKnowledgeGraph: () => knowledgeGraph,
  getSearchIndex: () => searchIndex,
  parsePlaybook,
  parseChecklist,
  INTELLIGENCE_DIR,
};
