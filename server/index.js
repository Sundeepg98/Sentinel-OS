const express = require('express');
const cors = require('cors');
const path = require('path');
const { Worker } = require('worker_threads');
const { Index } = require('flexsearch');
const { db, initDB } = require('./lib/db');
const { 
  GEMINI_API_KEY, 
  DEFAULT_MODEL, 
  generateStructuredContent, 
  getEmbedding,
  DRILL_SCHEMA,
  INCIDENT_SCHEMA,
  EVAL_SCHEMA,
  POST_MORTEM_SCHEMA
} = require('./lib/intelligence');
const { 
  getKnowledgeGraph, 
  INTELLIGENCE_DIR 
} = require('./lib/harvester');

const app = express();
const PORT = process.env.PORT || 3002;
const FRONTEND_DIST = path.join(__dirname, '..', 'dist');

// Initialize Core Systems
initDB();
app.use(cors());
app.use(express.json());
app.use(express.static(FRONTEND_DIST));

// Auth Middleware
const authGuard = (req, res, next) => {
  req.userId = 'local-admin'; 
  next();
};
app.use(authGuard);

// --- SYNCED STATE (Main Thread) ---
let knowledgeGraph = { concepts: {}, files: {} };
let searchIndex = new Index({ preset: 'score', tokenize: 'forward' });

// --- RAG WORKER ISOLATION ---
let isSyncing = false;
function spawnRAGWorker() {
  if (isSyncing) return;
  isSyncing = true;
  
  const worker = new Worker(path.join(__dirname, 'lib', 'rag-worker.js'));
  
  worker.on('message', (msg) => {
    if (msg.status === 'complete') {
      console.log(`📡 Main Loop: Hydrating Intelligence from Worker (${msg.duration}s)`);
      knowledgeGraph = msg.knowledgeGraph;
      
      // RE-BUILD SEARCH INDEX IN MAIN THREAD
      const newIndex = new Index({ preset: 'score', tokenize: 'forward' });
      Object.entries(knowledgeGraph.files).forEach(([id, file]) => {
        newIndex.add(id, file.content);
      });
      searchIndex = newIndex;
      console.log(`🔍 Main Loop: Search Index Synchronized.`);
      isSyncing = false;
    }
  });

  worker.on('error', (err) => {
    console.error('🧵 Worker Error:', err);
    isSyncing = false;
  });

  worker.on('exit', (code) => {
    isSyncing = false;
  });
}

// --- INTELLIGENCE FEEDBACK LOOP ---
let dynamicChunkId = 999000; 
async function learnFromProposal(userId, fileId, text, score) {
  if (score < 8) return; 
  try {
    const vector = await getEmbedding(text);
    const meta = { learned: true, contributor: userId, originalModule: fileId, timestamp: new Date().toISOString() };
    db.transaction(() => {
      const rowid = dynamicChunkId++;
      db.prepare(`INSERT INTO chunks_metadata (id, file_id, chunk_text, metadata) VALUES (?, ?, ?, ?)`).run(rowid, `learned/${fileId}`, text, JSON.stringify(meta));
      db.prepare(`INSERT INTO vec_chunks (id, vector) VALUES (?, ?)`).run(rowid, new Float32Array(vector));
    })();
  } catch (e) { console.error("Feedback Loop Error:", e.message); }
}

// --- API ENDPOINTS ---

app.get('/api/intelligence/stats', (req, res) => {
  const chunks = db.prepare("SELECT count(*) as count FROM chunks_metadata").get();
  const history = db.prepare("SELECT count(*) as count FROM interaction_history").get();
  const learned = db.prepare("SELECT count(*) as count FROM chunks_metadata WHERE file_id LIKE 'learned/%'").get();
  res.json({
    totalChunks: chunks.count,
    interactions: history.count,
    learnedAssets: learned.count,
    model: DEFAULT_MODEL,
    uptime: process.uptime(),
    isSyncing
  });
});

app.get('/api/intelligence/graph', (req, res) => {
  const nodes = []; const links = [];
  const rows = db.prepare("SELECT key, value FROM user_state WHERE user_id = ? AND (key LIKE 'tracker-%' OR key LIKE 'score-%')").all(req.userId);
  const trackers = {}; const scores = {};
  rows.forEach(row => {
    if (row.key.startsWith('tracker-')) trackers[row.key] = JSON.parse(row.value);
    if (row.key.startsWith('score-')) scores[row.key.replace('score-', '')] = JSON.parse(row.value);
  });

  const learnedModules = db.prepare("SELECT DISTINCT file_id, metadata FROM chunks_metadata WHERE file_id LIKE 'learned/%'").all();

  Object.entries(knowledgeGraph.files).forEach(([id, data]) => {
    const trackerKey = `tracker-${data.company}-${id.split('/').pop().replace('.md', '').toLowerCase()}`;
    const moduleTasks = trackers[trackerKey] || [];
    const trackerReadiness = moduleTasks.length > 0 ? (moduleTasks.filter(t => t.done).length / moduleTasks.length) * 0.5 : 0;
    const moduleScore = scores[id]?.lastScore || 0;
    const readiness = trackerReadiness + ((moduleScore / 10) * 0.5);
    nodes.push({ id, label: data.label, group: 'module', company: data.company, val: 15, readiness, blastRadius: data.keywords.length });
  });

  learnedModules.forEach(lm => {
    const meta = JSON.parse(lm.metadata);
    nodes.push({ id: lm.file_id, label: `💡 Learned: ${lm.file_id.split('/').pop()}`, group: 'learned', company: 'user', val: 10, readiness: 1, learned: true, originalModule: meta.originalModule });
    if (meta.originalModule) links.push({ source: meta.originalModule, target: lm.file_id, type: 'learned-from' });
  });

  Object.entries(knowledgeGraph.concepts).forEach(([concept, files]) => {
    if (files.length > 1) {
      nodes.push({ id: `concept:${concept}`, label: concept, group: 'concept', company: 'global', val: 8 });
      files.forEach(f => links.push({ source: f.fileId, target: `concept:${concept}`, keyword: concept }));
    }
  });
  res.json({ nodes, links });
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
  } catch (e) { 
    res.json({ keywords: file.keywords, related: [] }); 
  }
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
    const prompt = `You are a Staff Engineer interviewer. Generate ONE high-stakes technical drill.\nContext: ${extraContext || knowledgeGraph.files[fileId]?.content.slice(0, 3000)}`;
    const text = await generateStructuredContent(prompt, DRILL_SCHEMA);
    res.json(JSON.parse(text));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/intelligence/evaluate', async (req, res) => {
  const { userAnswer, question, idealResponse, fileId } = req.body;
  try {
    const prompt = `Staff Interview Evaluation. Q: ${question}\nIdeal: ${idealResponse}\nCandidate: "${userAnswer}"`;
    const text = await generateStructuredContent(prompt, EVAL_SCHEMA);
    const json = JSON.parse(text);
    if (json && json.score && fileId) {
      const numericScore = parseInt(json.score.split('/')[0]);
      if (!isNaN(numericScore)) {
        db.prepare(`INSERT INTO user_state (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`).run(req.userId, `score-${fileId}`, JSON.stringify({ lastScore: numericScore }));
        db.prepare(`INSERT INTO interaction_history (user_id, type, module_id, question, user_answer, evaluation, score) VALUES (?, 'drill', ?, ?, ?, ?, ?)`).run(req.userId, fileId, question, userAnswer, text, numericScore);
        learnFromProposal(req.userId, fileId, userAnswer, numericScore);
      }
    }
    res.json(json);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/intelligence/incident', async (req, res) => {
  const { moduleIds = [] } = req.body;
  if (!GEMINI_API_KEY) return res.status(500).json({ error: "API Key Missing" });
  let context = moduleIds.map(id => knowledgeGraph.files[id]?.content.slice(0, 1000)).join('\n\n') || "General System Architecture";

  try {
    const prompt = `You are a Chaos Engineering simulator for a Staff Engineer. Context: ${context}. Generate a critical production incident (P0/P1) based on this architecture.`;
    const text = await generateStructuredContent(prompt, INCIDENT_SCHEMA);
    res.json(JSON.parse(text));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/intelligence/incident/evaluate', async (req, res) => {
  const { userAnswer, incident } = req.body;
  if (!GEMINI_API_KEY) return res.status(500).json({ error: "API Key Missing" });
  
  try {
    const prompt = `Staff Engineer Incident Post-Mortem.\nIncident: ${incident.title}\nActual Root Cause: ${incident.rootCause}\nIdeal Mitigation: ${incident.idealMitigation}\nCandidate's Response: "${userAnswer}"`;
    const text = await generateStructuredContent(prompt, POST_MORTEM_SCHEMA);
    const json = JSON.parse(text);

    if (json && json.score) {
      const numericScore = parseInt(json.score.split('/')[0]);
      db.prepare(`INSERT INTO interaction_history (user_id, type, module_id, question, user_answer, evaluation, score) 
                 VALUES (?, 'incident', ?, ?, ?, ?, ?)`)
        .run(req.userId, incident.title, incident.title, userAnswer, text, isNaN(numericScore) ? 0 : numericScore);
    }
    res.json(json);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/dossier/:companyId', async (req, res) => {
  const fsNative = require('fs').promises;
  const matter = require('gray-matter');
  const { parsePlaybook, parseChecklist } = require('./lib/harvester');
  const companyDir = path.join(INTELLIGENCE_DIR, req.params.companyId);
  const files = await fsNative.readdir(companyDir);
  const modules = await Promise.all(files.filter(f => f.endsWith('.md')).map(async (fileName) => {
    const fileContent = await fsNative.readFile(path.join(companyDir, fileName), 'utf-8');
    const { data, content } = matter(fileContent);
    let processedData = content;
    if (data.type === 'playbook') processedData = parsePlaybook(content);
    if (data.type === 'checklist') processedData = parseChecklist(content);
    return { id: fileName.replace('.md', '').toLowerCase(), fullId: `${req.params.companyId}/${fileName}`, label: data.label || fileName.replace('.md', ''), type: data.type || 'markdown', icon: data.icon || 'FileText', data: data.data || processedData };
  }));
  res.json({ id: req.params.companyId, name: req.params.companyId.toUpperCase(), modules: modules.sort((a, b) => a.id.localeCompare(b.id)) });
});

app.get('/api/companies', async (req, res) => {
  const fsNative = require('fs').promises;
  const entries = await fsNative.readdir(INTELLIGENCE_DIR, { withFileTypes: true });
  res.json(entries.filter(d => d.isDirectory()).map(d => ({ id: d.name, name: d.name.toUpperCase() })));
});

app.get('/api/intelligence/history', (req, res) => {
  const rows = db.prepare("SELECT * FROM interaction_history WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50").all(req.userId);
  res.json(rows.map(r => ({ ...r, evaluation: JSON.parse(r.evaluation) })));
});

app.get('/api/state/:key', (req, res) => {
  const row = db.prepare("SELECT value FROM user_state WHERE user_id = ? AND key = ?").get(req.userId, req.params.key);
  res.json({ value: row ? JSON.parse(row.value) : null });
});

app.post('/api/state/:key', (req, res) => {
  db.prepare(`INSERT INTO user_state (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`).run(req.userId, req.params.key, JSON.stringify(req.body.value));
  res.json({ success: true });
});

app.get('/api/portfolio/export', (req, res) => {
  const rows = db.prepare("SELECT key, value FROM user_state WHERE user_id = ?").all(req.userId);
  let md = `# Staff Engineer Architectural Portfolio\n\n*Generated by Sentinel-OS*\n\n---\n\n## 🏆 Readiness & Mastery Tracker\n\n`;
  let hasTrackers = false;
  rows.forEach(row => {
    if (row.key.startsWith('tracker-')) {
      try {
        const tasks = JSON.parse(row.value);
        if (tasks && tasks.length > 0) {
          hasTrackers = true;
          const parts = row.key.split('-');
          md += `### ${parts[1].toUpperCase()} - ${parts.slice(2).join('-').toUpperCase()}\n`;
          tasks.forEach(t => { md += `- [${t.done ? 'x' : ' '}] ${t.text}\n`; });
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
          md += `### Module: ${row.key.replace('score-', '')}\n- **Highest Score**: ${data.lastScore}/10\n\n`;
        }
      } catch (e) {}
    }
  });
  if (!hasScores) md += `*No AI drill scores recorded yet.*\n\n`;
  md += `---\n*End of Report*\n`;
  res.setHeader('Content-Type', 'text/markdown');
  res.send(md);
});

app.get(/(.*)/, (req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));
app.listen(PORT, () => {
  console.log(`Intelligence Engine ACTIVE on ${PORT}`);
  spawnRAGWorker();
});
