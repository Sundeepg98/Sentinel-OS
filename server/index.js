const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');
const { Index } = require('flexsearch');
const natural = require('natural');
const axios = require('axios');
const Database = require('better-sqlite3');
const sqliteVec = require('sqlite-vec');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3002;

// --- PERSISTENCE ENGINE INITIALIZATION ---
const dbFile = path.join(__dirname, 'sentinel.db');
const db = new Database(dbFile);
sqliteVec.load(db);

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS user_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS intelligence_cache (
    file_id TEXT PRIMARY KEY,
    content_hash TEXT NOT NULL,
    label TEXT,
    company TEXT,
    keywords TEXT,
    last_processed DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chunks_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id TEXT,
    chunk_text TEXT,
    metadata TEXT,
    FOREIGN KEY(file_id) REFERENCES intelligence_cache(file_id) ON DELETE CASCADE
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
    id INTEGER PRIMARY KEY,
    vector FLOAT[3072]
  );
`);

app.use(cors());
app.use(express.json());

const INTELLIGENCE_DIR = path.join(__dirname, '..', 'intelligence');
const FRONTEND_DIST = path.join(__dirname, '..', 'dist');
app.use(express.static(FRONTEND_DIST));

const searchIndex = new Index({ preset: 'score', tokenize: 'forward' });
let knowledgeGraph = { concepts: {}, files: {} };

function extractKeywords(text) {
  const tokenizer = new natural.WordTokenizer();
  const words = tokenizer.tokenize(text.toLowerCase());
  const stopWords = new Set(['the', 'this', 'that', 'with', 'from', 'using', 'into', 'your', 'will', 'then', 'they', 'when', 'what']);
  const counts = {};
  words.filter(w => w.length > 3 && !stopWords.has(w)).forEach(w => counts[w] = (counts[w] || 0) + 1);
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e[0]);
}

async function getEmbedding(text) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return new Array(3072).fill(0);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${key}`;
    const response = await axios.post(url, {
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_DOCUMENT"
    });
    return response.data.embedding.values;
  } catch (e) {
    console.error('Embedding Error:', e.response?.data || e.message);
    return new Array(3072).fill(0);
  }
}

function chunkMarkdown(text, maxLength = 1000) {
  const chunks = [];
  let current = text;
  while (current.length > 0) {
    if (current.length <= maxLength) {
      chunks.push(current);
      break;
    }
    let slice = current.substring(0, maxLength);
    const lastNewline = slice.lastIndexOf('\n');
    if (lastNewline > maxLength * 0.7) slice = current.substring(0, lastNewline);
    chunks.push(slice);
    current = current.substring(slice.length).trim();
  }
  return chunks;
}

function getFileHash(content) {
  return crypto.createHash('md5').update(content).digest('hex');
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
          console.log(`📡 Processing: ${fileId}`);
          keywords = extractKeywords(content + ' ' + (data.label || ''));
          label = data.label || fileName;
          db.prepare(`INSERT INTO intelligence_cache (file_id, content_hash, label, company, keywords) VALUES (?, ?, ?, ?, ?) 
                     ON CONFLICT(file_id) DO UPDATE SET content_hash=excluded.content_hash, label=excluded.label, keywords=excluded.keywords, last_processed=CURRENT_TIMESTAMP`)
            .run(fileId, currentHash, label, company.name, JSON.stringify(keywords));
          processFileVectors(fileId, content, data);
        }
        searchIndex.add(fileId, content);
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
      // TRANSACTIONAL ATOMIC INSERT: Use last_insert_rowid() to prevent JS type conversion issues
      db.transaction(() => {
        db.prepare(`INSERT INTO chunks_metadata (file_id, chunk_text, metadata) VALUES (?, ?, ?)`).run(fileId, chunk, JSON.stringify(metadata));
        db.prepare(`INSERT INTO vec_chunks (id, vector) SELECT last_insert_rowid(), ?`).run(new Float32Array(vector));
      })();
    }
    console.log(`🧠 Vectorized: ${fileId}`);
  } catch (e) { console.error(`Vectorization Error [${fileId}]:`, e.message); }
}

setTimeout(syncIntelligence, 500);

app.get('/api/intelligence/graph', (req, res) => {
  const nodes = [];
  const links = [];
  const rows = db.prepare("SELECT key, value FROM user_state WHERE key LIKE 'tracker-%'").all();
  const readinessMap = {};
  rows.forEach(row => { try { const tasks = JSON.parse(row.value); readinessMap[row.key] = tasks.filter(t => t.done).length / tasks.length; } catch (e) {} });
  Object.entries(knowledgeGraph.files).forEach(([id, data]) => {
    const stateKey = `tracker-${data.company}-${id.split('/').pop().replace('.md', '').toLowerCase()}`;
    nodes.push({ id, label: data.label, group: 'module', company: data.company, val: 15, readiness: readinessMap[stateKey] || 0 });
  });
  Object.entries(knowledgeGraph.concepts).forEach(([concept, files]) => {
    if (files.length > 1) {
      nodes.push({ id: `concept:${concept}`, label: concept, group: 'concept', company: 'global', val: 8 });
      files.forEach(f => links.push({ source: f.fileId, target: `concept:${concept}`, keyword: concept }));
    }
  });
  res.json({ nodes, links });
});

app.get('/api/intelligence/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const results = searchIndex.search(q, { limit: 10 });
  res.json(results.map(id => ({ id, ...knowledgeGraph.files[id] })));
});

app.post('/api/intelligence/semantic-search', async (req, res) => {
  const { q, limit = 5 } = req.body;
  try {
    const vector = await getEmbedding(q);
    const results = db.prepare(`
      SELECT m.file_id, m.chunk_text, v.distance 
      FROM vec_chunks v
      JOIN chunks_metadata m ON v.id = m.id
      WHERE v.vector MATCH ? AND k = ?
      ORDER BY distance
    `).all(new Float32Array(vector), limit);
    res.json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/intelligence/drill', async (req, res) => {
  const { fileId, extraContext = "" } = req.body;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "API Key Missing" });
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const payload = { contents: [{ parts: [{ text: `Staff drill question. Context: ${extraContext || knowledgeGraph.files[fileId]?.content.slice(0, 3000)}. JSON expected.` }] }] };
    const response = await axios.post(url, payload);
    const text = response.data.candidates[0].content.parts[0].text;
    res.json(JSON.parse(text.match(/\{[\s\S]*\}/)[0]));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

const { GoogleGenerativeAI } = require("@google/generative-ai");
const activeChats = new Map();
app.post('/api/intelligence/evaluate', async (req, res) => {
  const { userAnswer, sessionId, question, idealResponse } = req.body;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "API Key Missing" });
  try {
    const genAI = new GoogleGenerativeAI(key);
    const gemini = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" });
    let chat = activeChats.get(sessionId);
    if (!chat) {
      chat = gemini.startChat({ history: [{ role: "user", parts: [{ text: `Staff Interview Mode. Q: ${question}. Criteria: ${idealResponse}` }] }, { role: "model", parts: [{ text: "Understood." }] }] });
      activeChats.set(sessionId, chat);
    }
    const result = await chat.sendMessage(`Proposal: "${userAnswer}". Evaluate in JSON.`);
    const text = (await result.response).text();
    res.json(JSON.parse(text.match(/\{[\s\S]*\}/)[0]));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/intelligence/insights', async (req, res) => {
  const { fileId } = req.query;
  if (!fileId) return res.status(400).json({ error: 'Missing fileId' });
  const file = knowledgeGraph.files[fileId];
  if (!file) return res.json({ keywords: [], related: [] });
  try {
    const vector = await getEmbedding(file.content.slice(0, 1000));
    const semanticMatches = db.prepare(`
      SELECT m.file_id, m.chunk_text, v.distance 
      FROM vec_chunks v
      JOIN chunks_metadata m ON v.id = m.id
      WHERE v.vector MATCH ? AND k = 5 AND m.file_id != ?
      ORDER BY distance
    `).all(new Float32Array(vector), fileId);
    const related = semanticMatches.map(m => ({ fileId: m.file_id, company: m.file_id.split('/')[0], sharedKeyword: 'semantic similarity' }));
    res.json({ keywords: file.keywords, related });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/companies', async (req, res) => {
  const entries = await fs.readdir(INTELLIGENCE_DIR, { withFileTypes: true });
  res.json(entries.filter(d => d.isDirectory()).map(d => ({ id: d.name, name: d.name.toUpperCase() })));
});

app.get('/api/dossier/:companyId', async (req, res) => {
  const { companyId } = req.params;
  const companyDir = path.join(INTELLIGENCE_DIR, companyId);
  const files = await fs.readdir(companyDir);
  const modules = await Promise.all(files.filter(f => f.endsWith('.md')).map(async (fileName) => {
    const fileContent = await fs.readFile(path.join(companyDir, fileName), 'utf-8');
    const { data, content } = matter(fileContent);
    return { id: fileName.replace('.md', '').toLowerCase(), fullId: `${companyId}/${fileName}`, label: data.label || fileName.replace('.md', ''), type: data.type || 'markdown', icon: data.icon || 'FileText', data: data.data || content };
  }));
  res.json({ id: companyId, name: companyId.toUpperCase(), modules: modules.sort((a, b) => a.id.localeCompare(b.id)) });
});

app.get('/api/state/:key', (req, res) => {
  const row = db.prepare("SELECT value FROM user_state WHERE key = ?").get(req.params.key);
  res.json({ value: row ? JSON.parse(row.value) : null });
});

app.post('/api/state/:key', (req, res) => {
  db.prepare(`INSERT INTO user_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`).run(req.params.key, JSON.stringify(req.body.value));
  res.json({ success: true });
});

app.get(/(.*)/, (req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));
app.listen(PORT, () => console.log(`Intelligence Engine ACTIVE on ${PORT}`));
