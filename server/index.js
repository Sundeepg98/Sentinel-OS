const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');
const { Index } = require('flexsearch');
const natural = require('natural');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3002;

// Initialize SQLite Persistence Engine
const dbFile = path.join(__dirname, 'sentinel.db');
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) console.error('SQLite initialization failed:', err);
  else {
    db.run(`CREATE TABLE IF NOT EXISTS user_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

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

async function syncIntelligence() {
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
        const keywords = extractKeywords(content + ' ' + (data.label || ''));
        searchIndex.add(fileId, content);
        newGraph.files[fileId] = { label: data.label || fileName, company: company.name, keywords, content };
        keywords.forEach(k => {
          if (!newGraph.concepts[k]) newGraph.concepts[k] = [];
          newGraph.concepts[k].push({ fileId, company: company.name });
        });
      }
    }
    knowledgeGraph = newGraph;
    console.log(`Knowledge Graph Synced: ${Object.keys(newGraph.files).length} nodes.`);
  } catch (e) { console.error('Sync Error:', e.message); }
}
syncIntelligence();

/**
 * AI Deep Drill - DEMO RESILIENT VERSION
 */
app.post('/api/intelligence/drill', async (req, res) => {
  const { fileId, model = 'gemini-2.5-flash' } = req.body;
  const key = process.env.GEMINI_API_KEY;
  
  const DEMO_FALLBACK = {
    question: "Given Mailin's massive outbound scale, how would you design a distributed 'Sliding Window' rate limiter in Redis that prevents ISP blacklisting while maintaining high throughput?",
    idealResponse: "Implement Redis Lua scripts for atomic increments, use a sorted set for high-precision windows, and provide local worker-level caching to reduce Redis overhead during traffic bursts."
  };

  if (!key) return res.json(DEMO_FALLBACK);

  try {
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${key}`;
    const payload = {
      contents: [{
        parts: [{
          text: `You are a Staff Engineer interviewer. Based on the technical notes, generate ONE challenging interview question. Respond in JSON: { "question": "...", "idealResponse": "..." }
          Notes: ${knowledgeGraph.files[fileId]?.content.slice(0, 3000)}`
        }]
      }]
    };

    const response = await axios.post(url, payload);
    const text = response.data.candidates[0].content.parts[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    res.json(JSON.parse(jsonMatch[jsonMatch.length - 1]));
  } catch (error) {
    console.log("Using Demo Fallback due to API Error");
    res.json(DEMO_FALLBACK);
  }
});

const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * AI Evaluation - CONVERSATIONAL ENGINE
 */
const activeChats = new Map();

app.post('/api/intelligence/evaluate', async (req, res) => {
  const { userAnswer, sessionId, question, idealResponse, model = 'gemini-2.5-flash' } = req.body;
  const key = process.env.GEMINI_API_KEY;

  const DEMO_EVAL = {
    score: "8/10",
    feedback: "Demo Mode: Your answer correctly identifies the need for atomicity. However, consider the impact of network partitions on Redis ZSET precision.",
    followUp: "How would you handle a failure in the Redis cluster itself during a high-velocity burst?"
  };

  if (!key) return res.json(DEMO_EVAL);

  try {
    const genAI = new GoogleGenerativeAI(key);
    const gemini = genAI.getGenerativeModel({ model });

    let chat = activeChats.get(sessionId);
    if (!chat) {
      chat = gemini.startChat({
        history: [
          { role: "user", parts: [{ text: `You are a strict Staff Engineer interviewer. Generate challenging follow-up questions based on my architectural proposals. Context Question: ${question}. Ideal Response Criteria: ${idealResponse}` }] },
          { role: "model", parts: [{ text: "Acknowledged. I am ready to evaluate your proposal and drill into the technical trade-offs." }] }
        ]
      });
      activeChats.set(sessionId, chat);
    }

    const result = await chat.sendMessage(`Candidate Proposal: "${userAnswer}". Evaluate technical depth and provide a score, feedback, and one challenging follow-up. Respond in JSON: { "score": "...", "feedback": "...", "followUp": "..." }`);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    res.json(jsonMatch ? JSON.parse(jsonMatch[0]) : { score: "N/A", feedback: text, followUp: "Please elaborate on your scaling strategy." });
  } catch (error) {
    console.error('CONVERSATIONAL EVAL FAILED:', error);
    res.json(DEMO_EVAL);
  }
});

app.get('/api/intelligence/graph', (req, res) => {
  const nodes = [];
  const links = [];
  const conceptToFiles = knowledgeGraph.concepts;
  
  // 1. Fetch all readiness states from DB
  db.all("SELECT key, value FROM user_state WHERE key LIKE 'tracker-%'", [], (err, rows) => {
    const readinessMap = {};
    if (!err && rows) {
      rows.forEach(row => {
        try {
          const tasks = JSON.parse(row.value);
          const done = tasks.filter(t => t.done).length;
          readinessMap[row.key] = done / tasks.length;
        } catch (e) {}
      });
    }

    // 2. Create File Nodes with readiness
    Object.entries(knowledgeGraph.files).forEach(([id, data]) => {
      const companyId = data.company;
      const moduleId = id.split('/').pop().replace('.md', '').toLowerCase();
      const stateKey = `tracker-${companyId}-${moduleId}`;
      
      nodes.push({ 
        id, 
        label: data.label, 
        group: 'module', 
        company: companyId,
        val: 15,
        readiness: readinessMap[stateKey] || 0
      });
    });

    // 3. Create Concept Nodes & Links
    Object.entries(conceptToFiles).forEach(([concept, files]) => {
      if (files.length > 1) {
        nodes.push({ 
          id: `concept:${concept}`, 
          label: concept, 
          group: 'concept', 
          company: 'global',
          val: 8 
        });

        files.forEach(f => {
          links.push({ 
            source: f.fileId, 
            target: `concept:${concept}`,
            keyword: concept 
          });
        });
      }
    });

    res.json({ nodes, links });
  });
});

app.get('/api/intelligence/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const results = searchIndex.search(q, { limit: 10 });
  res.json(results.map(id => ({ id, ...knowledgeGraph.files[id] })));
});

app.get('/api/intelligence/insights', (req, res) => {
  const { fileId } = req.query;
  const fileData = knowledgeGraph.files[fileId];
  if (!fileData) return res.status(404).json({ error: 'Not indexed' });
  const related = [];
  const seenFiles = new Set([fileId]);
  fileData.keywords.forEach(k => {
    (knowledgeGraph.concepts[k] || []).forEach(m => {
      if (!seenFiles.has(m.fileId)) { related.push({ ...m, sharedKeyword: k }); seenFiles.add(m.fileId); }
    });
  });
  res.json({ keywords: fileData.keywords, related: related.slice(0, 5) });
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
  res.json({ id: companyId, name: companyId.toUpperCase(), targetRole: 'L6 Staff Infrastructure Engineer', brandColor: 'cyan', modules: modules.sort((a, b) => a.id.localeCompare(b.id)) });
});

app.get('/api/state/:key', (req, res) => {
  db.get("SELECT value FROM user_state WHERE key = ?", [req.params.key], (err, row) => {
    res.json({ value: row ? JSON.parse(row.value) : null });
  });
});

app.post('/api/state/:key', (req, res) => {
  db.run(`INSERT INTO user_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [req.params.key, JSON.stringify(req.body.value)], () => res.json({ success: true }));
});

app.get(/(.*)/, (req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));
app.listen(PORT, () => console.log(`Intelligence Engine ACTIVE on ${PORT}`));
