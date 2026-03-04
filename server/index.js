const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');
const { Index } = require('flexsearch');
const natural = require('natural');
const Database = require('better-sqlite3');
const sqliteVec = require('sqlite-vec');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3002;

// --- INTELLIGENCE STANDARDS ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = "gemini-2.5-flash"; 
const EMBEDDING_MODEL = "gemini-embedding-001";
const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true';

const getGenAI = () => new GoogleGenerativeAI(GEMINI_API_KEY || '');

// --- PERSISTENCE ENGINE INITIALIZATION ---
const dbFile = path.join(__dirname, 'sentinel.db');
const db = new Database(dbFile);
sqliteVec.load(db);

// Initialize Tables with Multi-Tenant & History Support
db.exec(`
  CREATE TABLE IF NOT EXISTS user_state (
    user_id TEXT DEFAULT 'local-admin',
    key TEXT,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, key)
  );
  
  CREATE TABLE IF NOT EXISTS interaction_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'local-admin',
    type TEXT, -- 'drill' or 'incident'
    module_id TEXT,
    question TEXT,
    user_answer TEXT,
    evaluation TEXT,
    score INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
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

// Self-healing check for legacy schema (missing user_id)
try {
  db.prepare("SELECT user_id FROM user_state LIMIT 1").get();
} catch (e) {
  console.warn("⚠️ Migrating user_state to multi-tenant schema...");
  db.transaction(() => {
    db.exec(`ALTER TABLE user_state RENAME TO user_state_old;`);
    db.exec(`
      CREATE TABLE user_state (
        user_id TEXT DEFAULT 'local-admin',
        key TEXT,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(user_id, key)
      );
    `);
    db.exec(`INSERT INTO user_state (key, value, updated_at) SELECT key, value, updated_at FROM user_state_old;`);
    db.exec(`DROP TABLE user_state_old;`);
  })();
}

app.use(cors());
app.use(express.json());

// Auth Middleware (No-Blocker Strategy)
const authGuard = (req, res, next) => {
  if (!AUTH_ENABLED) {
    req.userId = 'local-admin';
    return next();
  }
  // TODO: Implement Clerk middleware here later
  req.userId = 'local-admin'; 
  next();
};

app.use(authGuard);

const INTELLIGENCE_DIR = path.join(__dirname, '..', 'intelligence');
const FRONTEND_DIST = path.join(__dirname, '..', 'dist');
app.use(express.static(FRONTEND_DIST));

const searchIndex = new Index({ preset: 'score', tokenize: 'forward' });
let knowledgeGraph = { concepts: {}, files: {} };

// --- MARKDOWN PARSING UTILITIES ---

function parsePlaybook(content) {
  const sections = content.split(/## Q:/).filter(s => s.trim().length > 0);
  return sections.map(s => {
    const lines = s.split('\n');
    const question = lines[0].trim();
    const trapMatch = s.match(/### The Trap Response\n([\s\S]*?)(?=###|$)/);
    const trapWhyMatch = s.match(/### Why it fails\n([\s\S]*?)(?=###|$)/);
    const optimalMatch = s.match(/### Optimal Staff Response\n([\s\S]*?)(?=###|$)/);
    
    return {
      q: question,
      trap: trapMatch ? trapMatch[1].trim() : "",
      trapWhy: trapWhyMatch ? trapWhyMatch[1].trim() : "",
      optimal: optimalMatch ? optimalMatch[1].trim() : ""
    };
  }).filter(p => p.q);
}

function parseChecklist(content) {
  const lines = content.split('\n');
  let id = 1;
  return lines
    .filter(l => l.trim().startsWith('-'))
    .map(l => ({
      id: id++,
      text: l.replace(/^-\s*(\[[\sxX]\])?\s*/, '').trim(),
      done: l.includes('[x]') || l.includes('[X]')
    }))
    .filter(t => t.text.length > 0);
}

function extractKeywords(text) {
  const tokenizer = new natural.WordTokenizer();
  const words = tokenizer.tokenize(text.toLowerCase());
  const stopWords = new Set(['the', 'this', 'that', 'with', 'from', 'using', 'into', 'your', 'will', 'then', 'they', 'when', 'what']);
  const counts = {};
  words.filter(w => w.length > 3 && !stopWords.has(w)).forEach(w => counts[w] = (counts[w] || 0) + 1);
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e[0]);
}

function extractJson(text) {
  try {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    const jsonStr = cleaned.substring(start, end + 1);
    return JSON.parse(jsonStr);
  } catch (e) {
    console.warn("AI JSON Extraction failed:", e.message);
    return null;
  }
}

async function getEmbedding(text) {
  if (!GEMINI_API_KEY) return new Array(3072).fill(0);
  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await model.embedContent({
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_DOCUMENT"
    });
    return result.embedding.values;
  } catch (e) {
    console.error('Embedding Error:', e.message);
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
      db.transaction(() => {
        db.prepare(`INSERT INTO chunks_metadata (file_id, chunk_text, metadata) VALUES (?, ?, ?)`).run(fileId, chunk, JSON.stringify(metadata));
        db.prepare(`INSERT INTO vec_chunks (id, vector) SELECT last_insert_rowid(), ?`).run(new Float32Array(vector));
      })();
    }
    console.log(`🧠 Vectorized: ${fileId}`);
  } catch (e) { console.error(`Vectorization Error [${fileId}]:`, e.message); }
}

setTimeout(syncIntelligence, 500);

// --- API ENDPOINTS ---

app.get('/api/intelligence/history', (req, res) => {
  const history = db.prepare("SELECT * FROM interaction_history WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50").all(req.userId);
  res.json(history.map(h => ({ ...h, evaluation: JSON.parse(h.evaluation) })));
});

app.get('/api/intelligence/graph', (req, res) => {
  const nodes = []; const links = [];
  const rows = db.prepare("SELECT key, value FROM user_state WHERE user_id = ? AND (key LIKE 'tracker-%' OR key LIKE 'score-%')").all(req.userId);
  
  const trackers = {};
  const scores = {};
  rows.forEach(row => {
    if (row.key.startsWith('tracker-')) trackers[row.key] = JSON.parse(row.value);
    if (row.key.startsWith('score-')) scores[row.key.replace('score-', '')] = JSON.parse(row.value);
  });

  Object.entries(knowledgeGraph.files).forEach(([id, data]) => {
    const trackerKey = `tracker-${data.company}-${id.split('/').pop().replace('.md', '').toLowerCase()}`;
    const moduleTasks = trackers[trackerKey] || [];
    const trackerReadiness = moduleTasks.length > 0 
      ? (moduleTasks.filter(t => t.done).length / moduleTasks.length) * 0.5 
      : 0;
    const moduleScore = scores[id]?.lastScore || 0;
    const scoreReadiness = (moduleScore / 10) * 0.5;
    const readiness = trackerReadiness + scoreReadiness;

    nodes.push({ id, label: data.label, group: 'module', company: data.company, val: 15, readiness });
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
  if (!GEMINI_API_KEY) return res.status(500).json({ error: "API Key Missing" });
  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });
    const prompt = `You are a Staff Engineer interviewer. Generate ONE high-stakes technical drill.
          Context: ${extraContext || knowledgeGraph.files[fileId]?.content.slice(0, 3000)}
          Respond ONLY in JSON: { "question": "...", "idealResponse": "..." }`;
    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    const json = extractJson(text);
    if (!json) throw new Error("Could not parse AI response as JSON");
    res.json(json);
  } catch (error) { 
    console.error("Drill Error:", error.message);
    res.status(500).json({ error: error.message }); 
  }
});

app.post('/api/intelligence/evaluate', async (req, res) => {
  const { userAnswer, question, idealResponse, fileId } = req.body;
  if (!GEMINI_API_KEY) return res.status(500).json({ error: "API Key Missing" });
  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });
    const prompt = `Staff Interview Evaluation. 
          Q: ${question}
          Ideal criteria: ${idealResponse}
          Candidate Proposal: "${userAnswer}"
          Evaluate in JSON: { "score": "X/10", "feedback": "...", "followUp": "..." }`;
    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    const json = extractJson(text);

    if (json && json.score && fileId) {
      const numericScore = parseInt(json.score.split('/')[0]);
      if (!isNaN(numericScore)) {
        db.prepare(`INSERT INTO user_state (user_id, key, value) VALUES (?, ?, ?) 
                   ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`)
          .run(req.userId, `score-${fileId}`, JSON.stringify({ lastScore: numericScore }));
        
        // Stack Knowledge in History
        db.prepare(`INSERT INTO interaction_history (user_id, type, module_id, question, user_answer, evaluation, score) 
                   VALUES (?, 'drill', ?, ?, ?, ?, ?)`)
          .run(req.userId, fileId, question, userAnswer, JSON.stringify(json), numericScore);
      }
    }

    res.json(json || { score: "N/A", feedback: text });
  } catch (error) { 
    console.error("Evaluation Error:", error.message);
    res.status(500).json({ error: error.message }); 
  }
});

app.post('/api/intelligence/incident', async (req, res) => {
  const { moduleIds = [] } = req.body;
  if (!GEMINI_API_KEY) return res.status(500).json({ error: "API Key Missing" });
  
  let context = "General System Architecture";
  if (moduleIds.length > 0) {
    context = moduleIds.map(id => knowledgeGraph.files[id]?.content.slice(0, 1000)).join('\n\n');
  }

  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });
    const prompt = `You are a Chaos Engineering simulator for a Staff Engineer. 
          Context: ${context}
          Generate a critical production incident (P0/P1) based on this architecture.
          Respond ONLY in JSON matching this exact structure:
          {
            "title": "Short descriptive title (e.g., SMTP Queue Overflow)",
            "description": "2-sentence summary of what the monitoring alerts are showing.",
            "logs": ["FATAL ERROR: xyz", "connection refused to redis:6379", "latency spiked 4000ms"],
            "rootCause": "The actual hidden architectural reason for the failure.",
            "idealMitigation": "What the Staff Engineer should immediately do to stop the bleeding and then fix permanently."
          }`;
    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    const json = extractJson(text);
    if (!json) throw new Error("Could not parse Incident JSON");
    res.json(json);
  } catch (error) { 
    console.error("Incident Generation Error:", error.message);
    res.status(500).json({ error: error.message }); 
  }
});

app.post('/api/intelligence/incident/evaluate', async (req, res) => {
  const { userAnswer, incident } = req.body;
  if (!GEMINI_API_KEY) return res.status(500).json({ error: "API Key Missing" });
  
  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });
    const prompt = `Staff Engineer Incident Post-Mortem.
          Incident: ${incident.title}
          Actual Root Cause: ${incident.rootCause}
          Ideal Mitigation: ${incident.idealMitigation}
          
          Candidate's Response: "${userAnswer}"
          
          Evaluate their crisis management and technical accuracy.
          Respond ONLY in JSON: { "score": "X/10", "feedback": "...", "missedSteps": ["...", "..."] }`;
    const result = await model.generateContent(prompt);
    const text = (await result.response).text();
    const json = extractJson(text);

    if (json && json.score) {
      const numericScore = parseInt(json.score.split('/')[0]);
      db.prepare(`INSERT INTO interaction_history (user_id, type, module_id, question, user_answer, evaluation, score) 
                 VALUES (?, 'incident', ?, ?, ?, ?, ?)`)
        .run(req.userId, incident.title, incident.title, userAnswer, JSON.stringify(json), isNaN(numericScore) ? 0 : numericScore);
    }

    res.json(json || { score: "N/A", feedback: text, missedSteps: [] });
  } catch (error) { 
    console.error("Incident Eval Error:", error.message);
    res.status(500).json({ error: error.message }); 
  }
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
    
    // STRUCTURED DATA PARSING FOR MODULES
    let processedData = content;
    if (data.type === 'playbook') processedData = parsePlaybook(content);
    if (data.type === 'checklist') processedData = parseChecklist(content);

    return { 
      id: fileName.replace('.md', '').toLowerCase(), 
      fullId: `${companyId}/${fileName}`, 
      label: data.label || fileName.replace('.md', ''), 
      type: data.type || 'markdown', 
      icon: data.icon || 'FileText', 
      data: data.data || processedData 
    };
  }));
  res.json({ id: companyId, name: companyId.toUpperCase(), modules: modules.sort((a, b) => a.id.localeCompare(b.id)) });
});

app.get('/api/portfolio/export', (req, res) => {
  const rows = db.prepare("SELECT key, value FROM user_state WHERE user_id = ?").all(req.userId);
  
  let md = `# Staff Engineer Architectural Portfolio\n\n`;
  md += `*Generated by Sentinel-OS*\n\n---\n\n`;

  md += `## 🏆 Readiness & Mastery Tracker\n\n`;
  let hasTrackers = false;
  rows.forEach(row => {
    if (row.key.startsWith('tracker-')) {
      try {
        const tasks = JSON.parse(row.value);
        if (tasks && tasks.length > 0) {
          hasTrackers = true;
          const parts = row.key.split('-');
          const company = parts[1];
          const module = parts.slice(2).join('-');
          md += `### ${company.toUpperCase()} - ${module.toUpperCase()}\n`;
          tasks.forEach(t => {
            md += `- [${t.done ? 'x' : ' '}] ${t.text}\n`;
          });
          md += `\n`;
        }
      } catch (e) {}
    }
  });
  if (!hasTrackers) md += `*No tracker data recorded yet.*\n\n`;

  md += `## 🧠 AI Drill Evaluations\n\n`;
  let hasScores = false;
  rows.forEach(row => {
    if (row.key.startsWith('score-')) {
      try {
        const data = JSON.parse(row.value);
        if (data && data.lastScore) {
          hasScores = true;
          const moduleName = row.key.replace('score-', '');
          md += `### Module: ${moduleName}\n`;
          md += `- **Highest Score**: ${data.lastScore}/10\n\n`;
        }
      } catch (e) {}
    }
  });
  if (!hasScores) md += `*No AI drill scores recorded yet.*\n\n`;

  md += `---\n*End of Report*\n`;
  
  res.setHeader('Content-Type', 'text/markdown');
  res.send(md);
});

app.get('/api/state/:key', (req, res) => {
  const row = db.prepare("SELECT value FROM user_state WHERE user_id = ? AND key = ?").get(req.userId, req.params.key);
  res.json({ value: row ? JSON.parse(row.value) : null });
});

app.post('/api/state/:key', (req, res) => {
  db.prepare(`INSERT INTO user_state (user_id, key, value) VALUES (?, ?, ?) 
             ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`)
    .run(req.userId, req.params.key, JSON.stringify(req.body.value));
  res.json({ success: true });
});

app.get(/(.*)/, (req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));
app.listen(PORT, () => console.log(`Intelligence Engine ACTIVE on ${PORT}`));
