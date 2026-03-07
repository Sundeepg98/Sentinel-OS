const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');
const { Index } = require('flexsearch');
const crypto = require('crypto');
const pLimit = require('p-limit');
const { z } = require('zod');
const { db, isPostgres } = require('./db');
const logger = require('./logger');
const { getEmbedding } = require('./intelligence');
const { parsePlaybook, parseChecklist } = require('./parsers');

const INTELLIGENCE_DIR = path.join(__dirname, '..', '..', 'intelligence');
let knowledgeGraph = { concepts: {}, files: {} };
let searchIndex = new Index({ preset: 'score', tokenize: 'forward' });

// --- 🛡️ DATA INTEGRITY SCHEMA ---
const dossierFrontmatterSchema = z.object({
  label: z.string().min(1, "Missing label frontmatter"),
  type: z.enum(['markdown', 'playbook', 'checklist', 'grid', 'map']).default('markdown'),
  icon: z.string().optional(),
  keywords: z.array(z.string()).optional()
});

/**
 * 🛰️ INTELLIGENCE HARVESTER (Cloud-Native Edition)
 * Orchestrates technical dossier parsing and RAG vectorization.
 */

function extractKeywords(text) {
  if (!text) return [];
  const clean = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  const words = clean.split(/\s+/).filter(w => w.length > 4);
  const stopWords = new Set(['about', 'above', 'after', 'again', 'against', 'could', 'should', 'would']);
  return [...new Set(words.filter(w => !stopWords.has(w)))].slice(0, 10);
}

function getFileHash(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

function chunkMarkdown(text, size = 1000) {
  const chunks = [];
  let current = "";
  text.split('\n').forEach(line => {
    if ((current + line).length > size) {
      chunks.push(current.trim());
      current = line + "\n";
    } else {
      current += line + "\n";
    }
  });
  if (current) chunks.push(current.trim());
  return chunks;
}

async function processFileVectors(fileId, content, metadata) {
  const limit = pLimit(5); // 🚀 Parallelize chunking
  try {
    if (isPostgres) {
      // 🐘 POSTGRES LOGIC (Atomic Transaction)
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("DELETE FROM chunks_metadata WHERE file_id = $1", [fileId]);
        const chunks = chunkMarkdown(content);
        const chunkTasks = chunks.map(chunk => limit(async () => {
          const vector = await getEmbedding(chunk);
          await client.query(
            "INSERT INTO chunks_metadata (file_id, chunk_text, metadata, embedding) VALUES ($1, $2, $3, $4)",
            [fileId, chunk, JSON.stringify(metadata), JSON.stringify(vector)]
          );
        }));
        await Promise.all(chunkTasks);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } else {
      // 🗄️ SQLITE LOGIC (Atomic Transaction)
      const chunks = chunkMarkdown(content);
      const chunkVectors = [];
      const chunkTasks = chunks.map(chunk => limit(async () => {
        const vector = await getEmbedding(chunk);
        chunkVectors.push({ chunk, vector });
      }));
      await Promise.all(chunkTasks);

      db.transaction(() => {
        const oldChunks = db.prepare("SELECT id FROM chunks_metadata WHERE file_id = ?").all(fileId);
        if (oldChunks.length > 0) {
          const oldIds = oldChunks.map(c => Number(c.id));
          db.prepare(`DELETE FROM vec_chunks WHERE id IN (${oldIds.join(',')})`).run();
          db.prepare(`DELETE FROM chunks_metadata WHERE file_id = ?`).run(fileId);
        }
        
        for (const { chunk, vector } of chunkVectors) {
          db.prepare(`INSERT INTO chunks_metadata (file_id, chunk_text, metadata) VALUES (?, ?, ?)`).run(fileId, chunk, JSON.stringify(metadata));
          db.prepare(`INSERT INTO vec_chunks (id, vector) SELECT last_insert_rowid(), ?`).run(new Float32Array(vector));
        }
      })();
    }
  } catch (e) { logger.error({ fileId, error: e.message }, '🧵 Vectorization Error'); }
}

async function syncIntelligence() {
  logger.info('🔄 Sentinel Intelligence Sync: Scanning...');
  const limit = pLimit(5); // 🚀 Throttled Concurrency
  const newGraph = { concepts: {}, files: {} };
  searchIndex = new Index({ preset: 'score', tokenize: 'forward' });
  const activeFileIds = new Set();

  try {
    // 1. Process Local Files
    const companyFolders = await fs.readdir(INTELLIGENCE_DIR, { withFileTypes: true });
    const syncTasks = [];

    for (const company of companyFolders.filter(d => d.isDirectory())) {
      const companyPath = path.join(INTELLIGENCE_DIR, company.name);
      const files = await fs.readdir(companyPath);
      
      for (const fileName of files.filter(f => f.endsWith('.md'))) {
        syncTasks.push(limit(async () => {
          const filePath = path.join(companyPath, fileName);
          const fileContent = await fs.readFile(filePath, 'utf-8');
          const { content, data } = matter(fileContent);
          
          const validation = dossierFrontmatterSchema.safeParse(data);
          if (!validation.success) {
            logger.warn({ file: fileName, errors: validation.error.format() }, '⚠️ Invalid frontmatter in technical dossier');
          }
          
          const validatedData = validation.success ? validation.data : { label: fileName, type: 'markdown' };
          const fileId = `${company.name}/${fileName}`.toLowerCase(); 
          activeFileIds.add(fileId);
          const currentHash = getFileHash(fileContent);

          // --- CLOUD CACHE CHECK ---
          let shouldProcess = true;
          if (isPostgres) {
            // Fix: Store and check the content hash in Postgres too for hot-reloading support
            const cached = await db.query("SELECT id, content FROM dossiers WHERE id = $1", [fileId]);
            if (cached.rows[0]) {
              const dbHash = getFileHash(cached.rows[0].content);
              if (dbHash === currentHash) shouldProcess = false;
            }
          } else {
            const cached = db.prepare("SELECT content_hash FROM intelligence_cache WHERE file_id = ?").get(fileId);
            if (cached && cached.content_hash === currentHash) shouldProcess = false;
          }

          if (shouldProcess) {
            const label = validatedData.label || fileName;
            if (isPostgres) {
              await db.query(
                "INSERT INTO dossiers (id, company, label, content, metadata) VALUES ($1, $2, $3, $4, $5) ON CONFLICT(id) DO UPDATE SET content=excluded.content, metadata=excluded.metadata, label=excluded.label",
                [fileId, company.name, label, content, JSON.stringify(data)]
              );
            } else {
              const keywords = extractKeywords(content + ' ' + (validatedData.label || ''));
              db.prepare(`INSERT INTO intelligence_cache (file_id, content_hash, label, company, keywords) VALUES (?, ?, ?, ?, ?) ON CONFLICT(file_id) DO UPDATE SET content_hash=excluded.content_hash`).run(fileId, currentHash, label, company.name, JSON.stringify(keywords));
            }
            await processFileVectors(fileId, content, data);
          }

          // --- HYDRATE GRAPH ---
          const finalKeywords = extractKeywords(content);
          newGraph.files[fileId] = { label: validatedData.label || fileName, company: company.name, keywords: finalKeywords, content };
          finalKeywords.forEach(k => {
            if (!newGraph.concepts[k]) newGraph.concepts[k] = [];
            newGraph.concepts[k].push({ fileId, company: company.name });
          });
          searchIndex.add(fileId, content);
        }));
      }
    }

    await Promise.all(syncTasks);

    // 2. Load Cloud-only dossiers (learned assets)
    if (isPostgres) {
      const cloudDossiers = await db.prepare("SELECT id, company, label, content, metadata FROM dossiers").all();
      cloudDossiers.forEach(d => {
        if (!activeFileIds.has(d.id)) {
          const keywords = extractKeywords(d.content);
          newGraph.files[d.id] = { label: d.label, company: d.company, keywords, content: d.content };
          keywords.forEach(k => {
            if (!newGraph.concepts[k]) newGraph.concepts[k] = [];
            newGraph.concepts[k].push({ fileId: d.id, company: d.company });
          });
          searchIndex.add(d.id, d.content);
        }
      });
    }

    knowledgeGraph = newGraph;

    // --- 🗑️ INTELLIGENCE PRUNING (Garbage Collection) ---
    if (isPostgres) {
      const allDossiers = await db.prepare("SELECT id FROM dossiers").all();
      for (const d of allDossiers) {
        if (!activeFileIds.has(d.id) && d.id.includes('/')) { 
          logger.info({ dossierId: d.id }, '🗑️ Pruning ghost dossier from DB');
          await db.query("DELETE FROM dossiers WHERE id = $1", [d.id]);
          await db.query("DELETE FROM chunks_metadata WHERE file_id = $1", [d.id]);
        }
      }
    } else {
      const allCached = db.prepare("SELECT file_id FROM intelligence_cache").all();
      for (const c of allCached) {
        if (!activeFileIds.has(c.file_id)) {
          logger.info({ fileId: c.file_id }, '🗑️ Pruning ghost dossier from Cache');
          db.prepare("DELETE FROM intelligence_cache WHERE file_id = ?").run(c.file_id);
          db.prepare("DELETE FROM chunks_metadata WHERE file_id = ?").run(c.file_id);
        }
      }
    }

    logger.info('✅ Intelligence Engine ACTIVE.');
  } catch (e) { logger.error({ error: e.message }, '🧵 Sync Error'); }
}

module.exports = { syncIntelligence, getKnowledgeGraph: () => knowledgeGraph, getSearchIndex: () => searchIndex, parsePlaybook, parseChecklist, INTELLIGENCE_DIR };
