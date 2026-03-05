const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');
const { Index } = require('flexsearch');
const crypto = require('crypto');
const { db, isPostgres } = require('./db');
const { getEmbedding } = require('./intelligence');
const { parsePlaybook, parseChecklist } = require('./parsers');

const INTELLIGENCE_DIR = path.join(__dirname, '..', '..', 'intelligence');
let knowledgeGraph = { concepts: {}, files: {} };
let searchIndex = new Index({ preset: 'score', tokenize: 'forward' });

/**
 * 🛰️ INTELLIGENCE HARVESTER (Cloud-Native Edition)
 * Orchestrates technical dossier parsing and RAG vectorization.
 * Supports both local ephemeral SQLite and persistent Cloud Postgres.
 */

function extractKeywords(text) {
  try {
    const words = text.toLowerCase().split(/\W+/);
    const stopWords = new Set(['the', 'this', 'that', 'with', 'from', 'using', 'into', 'your', 'will', 'then', 'they', 'when', 'what', 'these', 'those', 'about']);
    const counts = {};
    words.filter(w => w.length > 3 && !stopWords.has(w)).forEach(w => counts[w] = (counts[w] || 0) + 1);
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e[0]);
  } catch (e) {
    return [];
  }
}

function getFileHash(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

function chunkMarkdown(text, maxLength = 1500) {
  const chunks = [];
  const splitRecursive = (content, headerLevel = 1) => {
    if (content.length <= maxLength) { if (content.trim()) chunks.push(content.trim()); return; }
    const headerRegex = new RegExp(`^#{${headerLevel}}\\s+`, 'm');
    const parts = content.split(headerRegex).filter(p => p.trim());
    if (parts.length > 1) { parts.forEach(p => splitRecursive(p, headerLevel + 1)); }
    else if (headerLevel < 4) { splitRecursive(content, headerLevel + 1); }
    else {
      const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
      let currentChunk = "";
      for (const p of paragraphs) {
        if ((currentChunk + p).length > maxLength && currentChunk) { chunks.push(currentChunk.trim()); currentChunk = p; }
        else { currentChunk += (currentChunk ? "\n\n" : "") + p; }
      }
      if (currentChunk.length > maxLength) {
        let remaining = currentChunk;
        while (remaining.length > 0) { chunks.push(remaining.substring(0, maxLength)); remaining = remaining.substring(maxLength); }
      } else if (currentChunk) { chunks.push(currentChunk.trim()); }
    }
  };
  splitRecursive(text);
  return chunks;
}

async function processFileVectors(fileId, content, metadata) {
  try {
    if (isPostgres) {
      // 🐘 POSTGRES LOGIC
      await db.query("DELETE FROM chunks_metadata WHERE file_id = $1", [fileId]);
      const chunks = chunkMarkdown(content);
      for (const chunk of chunks) {
        const vector = await getEmbedding(chunk);
        await db.query(
          "INSERT INTO chunks_metadata (file_id, chunk_text, metadata, embedding) VALUES ($1, $2, $3, $4)",
          [fileId, chunk, JSON.stringify(metadata), JSON.stringify(vector)]
        );
      }
    } else {
      // 🗄️ SQLITE LOGIC
      const oldChunks = db.prepare("SELECT id FROM chunks_metadata WHERE file_id = ?").all(fileId);
      if (oldChunks.length > 0) {
        const oldIds = oldChunks.map(c => Number(c.id));
        db.prepare(`DELETE FROM vec_chunks WHERE id IN (${oldIds.join(',')})`).run();
        db.prepare(`DELETE FROM chunks_metadata WHERE file_id = ?`).run(fileId);
      }
      const chunks = chunkMarkdown(content);
      for (const chunk of chunks) {
        const vector = await getEmbedding(chunk);
        db.prepare(`INSERT INTO chunks_metadata (file_id, chunk_text, metadata) VALUES (?, ?, ?)`).run(fileId, chunk, JSON.stringify(metadata));
        db.prepare(`INSERT INTO vec_chunks (id, vector) SELECT last_insert_rowid(), ?`).run(new Float32Array(vector));
      }
    }
  } catch (e) { console.error(`Vectorization Error [${fileId}]:`, e.message); }
}

async function syncIntelligence() {
  console.log('🔄 Sentinel Intelligence Sync: Scanning...');
  const newGraph = { concepts: {}, files: {} };
  searchIndex = new Index({ preset: 'score', tokenize: 'forward' });
  const activeFileIds = new Set();

  try {
    // 1. Process Local Files
    const companies = await fs.readdir(INTELLIGENCE_DIR, { withFileTypes: true });
    for (const company of companies.filter(d => d.isDirectory())) {
      const companyPath = path.join(INTELLIGENCE_DIR, company.name);
      const files = await fs.readdir(companyPath);
      for (const fileName of files.filter(f => f.endsWith('.md'))) {
        const filePath = path.join(companyPath, fileName);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const { content, data } = matter(fileContent);
        const fileId = `${company.name}/${fileName}`;
        activeFileIds.add(fileId);
        const currentHash = getFileHash(fileContent);

        // --- CLOUD CACHE CHECK ---
        let shouldProcess = true;
        if (isPostgres) {
          const cached = await db.prepare("SELECT last_processed FROM dossiers WHERE id = $1").get(fileId);
          // For Postgres, we prioritize what's in the DB over what's on the ephemeral disk
          if (cached) shouldProcess = false; 
        } else {
          const cached = db.prepare("SELECT content_hash FROM intelligence_cache WHERE file_id = ?").get(fileId);
          if (cached && cached.content_hash === currentHash) shouldProcess = false;
        }

        if (shouldProcess) {
          const keywords = extractKeywords(content + ' ' + (data.label || ''));
          const label = data.label || fileName;
          
          if (isPostgres) {
            await db.query(
              "INSERT INTO dossiers (id, company, label, content, metadata) VALUES ($1, $2, $3, $4, $5) ON CONFLICT(id) DO UPDATE SET content=excluded.content, metadata=excluded.metadata",
              [fileId, company.name, label, content, JSON.stringify(data)]
            );
          } else {
            db.prepare(`INSERT INTO intelligence_cache (file_id, content_hash, label, company, keywords) VALUES (?, ?, ?, ?, ?) ON CONFLICT(file_id) DO UPDATE SET content_hash=excluded.content_hash`).run(fileId, currentHash, label, company.name, JSON.stringify(keywords));
          }
          await processFileVectors(fileId, content, data);
        }

        // --- HYDRATE GRAPH ---
        // Fetch from DB to ensure we have the content
        let finalContent = content;
        let finalLabel = data.label || fileName;
        let finalKeywords = extractKeywords(content);

        newGraph.files[fileId] = { label: finalLabel, company: company.name, keywords: finalKeywords, content: finalContent };
        finalKeywords.forEach(k => {
          if (!newGraph.concepts[k]) newGraph.concepts[k] = [];
          newGraph.concepts[k].push({ fileId, company: company.name });
        });
        searchIndex.add(fileId, finalContent);
      }
    }

    // 2. Load Cloud-only dossiers (learned assets)
    if (isPostgres) {
      const cloudDossiers = await db.prepare("SELECT id, company, label, content, metadata FROM dossiers").all();
      cloudDossiers.forEach(d => {
        if (!activeFileIds.has(d.id)) {
          const meta = JSON.parse(d.metadata);
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
    console.log(`✅ Intelligence Engine ACTIVE.`);
  } catch (e) { console.error('Sync Error:', e.message); }
}

module.exports = { syncIntelligence, getKnowledgeGraph: () => knowledgeGraph, getSearchIndex: () => searchIndex, parsePlaybook, parseChecklist, INTELLIGENCE_DIR };
