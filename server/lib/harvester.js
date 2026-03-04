const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');
const { Index } = require('flexsearch');
const natural = require('natural');
const crypto = require('crypto');
const { db } = require('./db');
const { getEmbedding } = require('./intelligence');

const INTELLIGENCE_DIR = path.join(__dirname, '..', '..', 'intelligence');
let knowledgeGraph = { concepts: {}, files: {} };
let searchIndex = new Index({ preset: 'score', tokenize: 'forward' });

function parsePlaybook(content) {
  const sections = content.split(/## Q:/).filter(s => s.trim().length > 0);
  return sections.map(s => {
    const lines = s.split('\n');
    const question = lines[0].trim();
    const trapMatch = s.match(/### The Trap Response\n([\s\S]*?)(?=###|$)/);
    const trapWhyMatch = s.match(/### Why it fails\n([\s\S]*?)(?=###|$)/);
    const optimalMatch = s.match(/### Optimal Staff Response\n([\s\S]*?)(?=###|$)/);
    return { q: question, trap: trapMatch ? trapMatch[1].trim() : "", trapWhy: trapWhyMatch ? trapWhyMatch[1].trim() : "", optimal: optimalMatch ? optimalMatch[1].trim() : "" };
  }).filter(p => p.q);
}

function parseChecklist(content) {
  const lines = content.split('\n');
  let id = 1;
  return lines.filter(l => l.trim().startsWith('-')).map(l => ({ id: id++, text: l.replace(/^-\s*(\[[\sxX]\])?\s*/, '').trim(), done: l.includes('[x]') || l.includes('[X]') })).filter(t => t.text.length > 0);
}

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
    const oldChunks = db.prepare("SELECT id FROM chunks_metadata WHERE file_id = ?").all(fileId);
    if (oldChunks.length > 0) {
      const oldIds = oldChunks.map(c => Number(c.id));
      db.prepare(`DELETE FROM vec_chunks WHERE id IN (${oldIds.join(',')})`).run();
      db.prepare(`DELETE FROM chunks_metadata WHERE file_id = ?`).run(fileId);
    }
    const chunks = chunkMarkdown(content);
    for (const chunk of chunks) {
      const vector = await getEmbedding(chunk);
      db.transaction(() => {
        db.prepare(`INSERT INTO chunks_metadata (file_id, chunk_text, metadata) VALUES (?, ?, ?)`).run(fileId, chunk, JSON.stringify(metadata));
        db.prepare(`INSERT INTO vec_chunks (id, vector) SELECT last_insert_rowid(), ?`).run(new Float32Array(vector));
      })();
    }
  } catch (e) { console.error(`Vectorization Error [${fileId}]:`, e.message); }
}

async function syncIntelligence() {
  console.log('🔄 Sentinel Intelligence Sync: Scanning...');
  const newGraph = { concepts: {}, files: {} };
  try {
    const companies = await fs.readdir(INTELLIGENCE_DIR, { withFileTypes: true });
    for (const company of companies.filter(d => d.isDirectory())) {
      const companyPath = path.join(INTELLIGENCE_DIR, company.name);
      const files = await fs.readdir(companyPath);
      for (const fileName of files.filter(f => f.endsWith('.md'))) {
        const filePath = path.join(companyPath, fileName);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const { content, data } = matter(fileContent);
        const fileId = `${company.name}/${fileName}`;
        const currentHash = getFileHash(fileContent);

        const cached = db.prepare("SELECT content_hash, keywords, label FROM intelligence_cache WHERE file_id = ?").get(fileId);
        const vectorRow = db.prepare(`SELECT count(*) as count FROM chunks_metadata m JOIN vec_chunks v ON m.id = v.id WHERE m.file_id = ?`).get(fileId);
        
        let keywords, label;
        if (cached && cached.content_hash === currentHash && (vectorRow?.count || 0) > 0) {
          keywords = JSON.parse(cached.keywords);
          label = cached.label;
        } else {
          keywords = extractKeywords(content + ' ' + (data.label || ''));
          label = data.label || fileName;
          db.prepare(`INSERT INTO intelligence_cache (file_id, content_hash, label, company, keywords) VALUES (?, ?, ?, ?, ?) 
                     ON CONFLICT(file_id) DO UPDATE SET content_hash=excluded.content_hash, label=excluded.label, keywords=excluded.keywords, last_processed=CURRENT_TIMESTAMP`)
            .run(fileId, currentHash, label, company.name, JSON.stringify(keywords));
          await processFileVectors(fileId, content, data);
        }
        
        try { searchIndex.add(fileId, content); } catch(e) {}
        
        newGraph.files[fileId] = { label, company: company.name, keywords, content };
        keywords.forEach(k => {
          if (!newGraph.concepts[k]) newGraph.concepts[k] = [];
          newGraph.concepts[k].push({ fileId, company: company.name });
        });
      }
    }
    knowledgeGraph = newGraph;
    console.log(`✅ Intelligence Engine ACTIVE.`);
  } catch (e) { console.error('Sync Error:', e.message); }
}

module.exports = { 
  syncIntelligence, 
  getKnowledgeGraph: () => knowledgeGraph, 
  getSearchIndex: () => searchIndex, 
  parsePlaybook, 
  parseChecklist,
  INTELLIGENCE_DIR
};
