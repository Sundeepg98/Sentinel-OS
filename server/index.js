const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');
const { Index } = require('flexsearch');
const natural = require('natural');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Gemini (Free Tier available via Google AI Studio)
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

app.use(cors());
app.use(express.json());

const INTELLIGENCE_DIR = path.join(__dirname, '..', 'intelligence');
const FRONTEND_DIST = path.join(__dirname, '..', 'dist');
app.use(express.static(FRONTEND_DIST));

const searchIndex = new Index({ preset: 'score', tokenize: 'forward' });
let knowledgeGraph = { concepts: {}, files: {} };

/**
 * Heuristic Intelligence: Keyword Extractor
 */
function extractKeywords(text) {
  const tokenizer = new natural.WordTokenizer();
  const words = tokenizer.tokenize(text.toLowerCase());
  const stopWords = new Set(['the', 'this', 'that', 'with', 'from', 'using', 'into', 'your', 'will', 'then', 'when', 'what']);
  const counts = {};
  words.filter(w => w.length > 3 && !stopWords.has(w)).forEach(w => counts[w] = (counts[w] || 0) + 1);
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => entry = e[0]);
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
 * AI Intelligence: Gemini Drill Generation
 */
app.post('/api/intelligence/drill', async (req, res) => {
  const { fileId } = req.body;
  const fileData = knowledgeGraph.files[fileId];

  if (!genAI) return res.json({ error: 'GEMINI_API_KEY not configured. Add it to server/.env to enable AI Drills.' });
  if (!fileData) return res.status(404).json({ error: 'Content not found' });

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `You are a Staff Engineer interviewer. Based on the following technical notes, generate ONE challenging "Deep Drill" interview question that tests architectural trade-offs or low-level internals. 
    
    Context:
    ${fileData.content.slice(0, 2000)}
    
    Respond in JSON format:
    { "question": "the question", "idealResponse": "points to cover in response" }`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    // Extract JSON from potential markdown blocks
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    res.json(JSON.parse(jsonMatch[jsonMatch.length - 1]));
  } catch (error) {
    res.status(500).json({ error: 'AI Generation failed' });
  }
});

app.get('/api/intelligence/insights', (req, res) => {
  const { fileId } = req.query;
  const fileData = knowledgeGraph.files[fileId];
  if (!fileData) return res.status(404).json({ error: 'File not indexed' });
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
  try {
    const entries = await fs.readdir(INTELLIGENCE_DIR, { withFileTypes: true });
    res.json(entries.filter(d => d.isDirectory()).map(d => ({ id: d.name, name: d.name.toUpperCase() })));
  } catch (e) { res.status(500).json({ error: 'Discovery failed' }); }
});

app.get('/api/dossier/:companyId', async (req, res) => {
  const { companyId } = req.params;
  const companyDir = path.join(INTELLIGENCE_DIR, companyId);
  try {
    const files = await fs.readdir(companyDir);
    const modules = await Promise.all(files.filter(f => f.endsWith('.md')).map(async (fileName) => {
      const fileContent = await fs.readFile(path.join(companyDir, fileName), 'utf-8');
      const { data, content } = matter(fileContent);
      const type = data.type || 'markdown';
      return { id: fileName.replace('.md', '').toLowerCase(), fullId: `${companyId}/${fileName}`, label: data.label || fileName.replace('.md', ''), type, icon: data.icon || 'FileText', data: data.data || parseMarkdownToModuleData(type, content) };
    }));
    res.json({ id: companyId, name: companyId.toUpperCase(), targetRole: companyId === 'mailin' ? 'L6 Staff Infrastructure Engineer' : 'Infrastructure & Pulumi Architect', brandColor: companyId === 'mailin' ? 'cyan' : 'indigo', modules: modules.sort((a, b) => a.id.localeCompare(b.id)) });
  } catch (e) { res.status(404).json({ error: 'Not found' }); }
});

function parseMarkdownToModuleData(type, content) {
  if (type === 'list') return [{ category: 'Documentation', items: [{ title: 'Notes', desc: content.slice(0, 500) + '...', impact: 'Full view enabled.', solution: 'N/A' }] }];
  if (type === 'playbook') {
    const sections = content.split(/\n###?\s+/);
    let q = 'Question missing', t = 'Trap missing', w = 'Context missing', o = 'Solution missing';
    sections.forEach(s => {
      const tr = s.trim();
      if (tr.startsWith('Q:')) q = tr.replace(/^Q:\s*/, '');
      if (tr.startsWith('The Trap Response')) t = tr.replace(/^The Trap Response\s*/, '');
      if (tr.startsWith('Why it fails')) w = tr.replace(/^Why it fails\s*/, '');
      if (tr.startsWith('Optimal Staff Response')) o = tr.replace(/^Optimal Staff Response\s*/, '');
    });
    return [{ q, trap: t, trapWhy: w, optimal: o }];
  }
  return content;
}

app.get('*', (req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));
app.listen(PORT, () => console.log(`Sentinel Intelligence Engine active on port ${PORT}`));
