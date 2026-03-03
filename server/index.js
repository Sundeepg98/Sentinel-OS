const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');
const { Index } = require('flexsearch');
const natural = require('natural');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static files from the React frontend build
const FRONTEND_DIST = path.join(__dirname, '..', 'dist');
app.use(express.static(FRONTEND_DIST));

const INTELLIGENCE_DIR = path.join(__dirname, '..', 'intelligence');

// Initialize Semantic Index
const searchIndex = new Index({
  preset: 'score',
  tokenize: 'forward'
});

// Cache for Knowledge Graph
let knowledgeGraph = {
  concepts: {}, // keyword -> file links
  files: {}     // file -> keywords
};

/**
 * Intelligent Keyword Extractor (TF-IDF Lite)
 */
function extractKeywords(text) {
  const tokenizer = new natural.WordTokenizer();
  const words = tokenizer.tokenize(text.toLowerCase());
  
  // Filter out common stopwords and short words
  const stopWords = new Set(['the', 'this', 'that', 'with', 'from', 'using', 'into', 'your', 'will', 'then', 'they', 'when', 'what']);
  const filtered = words.filter(w => w.length > 3 && !stopWords.has(w));
  
  // Count frequencies
  const counts = {};
  filtered.forEach(w => counts[w] = (counts[w] || 0) + 1);
  
  // Sort by frequency and return top 10
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(entry => entry[0]);
}

/**
 * Knowledge Sync: Rebuilds the search index and graph
 */
async function syncIntelligence() {
  console.log('Synchronizing Technical Intelligence...');
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
        
        // Update Search Index
        searchIndex.add(fileId, content);
        
        // Update Graph
        newGraph.files[fileId] = {
          label: data.label || fileName,
          company: company.name,
          keywords
        };
        
        keywords.forEach(k => {
          if (!newGraph.concepts[k]) newGraph.concepts[k] = [];
          newGraph.concepts[k].push({ fileId, company: company.name });
        });
      }
    }
    knowledgeGraph = newGraph;
    console.log(`Sync Complete. Indexed ${Object.keys(newGraph.files).length} files.`);
  } catch (e) {
    console.error('Sync Error:', e.message);
  }
}

// Initial Sync
syncIntelligence();

/**
 * 1. Global Intelligence Search
 */
app.get('/api/intelligence/search', (req, res) => {
  const { q } = req.query;
  const results = searchIndex.search(q, { limit: 10 });
  
  const detailedResults = results.map(id => ({
    id,
    ...knowledgeGraph.files[id]
  }));
  
  res.json(detailedResults);
});

/**
 * 2. Get Insights for a specific file
 */
app.get('/api/intelligence/insights', (req, res) => {
  const { fileId } = req.query;
  const fileData = knowledgeGraph.files[fileId];
  
  if (!fileData) return res.status(404).json({ error: 'File not indexed' });
  
  // Find related files based on shared keywords
  const related = [];
  const seenFiles = new Set([fileId]);
  
  fileData.keywords.forEach(k => {
    const matches = knowledgeGraph.concepts[k] || [];
    matches.forEach(m => {
      if (!seenFiles.has(m.fileId)) {
        related.push({ ...m, sharedKeyword: k });
        seenFiles.add(m.fileId);
      }
    });
  });

  res.json({
    keywords: fileData.keywords,
    related: related.slice(0, 5)
  });
});

/**
 * 3. Company Discovery
 */
app.get('/api/companies', async (req, res) => {
  try {
    const entries = await fs.readdir(INTELLIGENCE_DIR, { withFileTypes: true });
    const companies = entries
      .filter(dirent => dirent.isDirectory())
      .map(dirent => ({
        id: dirent.name,
        name: dirent.name.toUpperCase()
      }));
    res.json(companies);
  } catch (error) {
    res.status(500).json({ error: 'Failed to discover companies' });
  }
});

/**
 * 4. Dossier Harvester
 */
app.get('/api/dossier/:companyId', async (req, res) => {
  const { companyId } = req.params;
  const companyDir = path.join(INTELLIGENCE_DIR, companyId);

  try {
    const files = await fs.readdir(companyDir);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    const modules = await Promise.all(mdFiles.map(async (fileName) => {
      const filePath = path.join(companyDir, fileName);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const { data, content } = matter(fileContent);
      const moduleType = data.type || 'markdown';

      return {
        id: fileName.replace('.md', '').toLowerCase(),
        fullId: `${companyId}/${fileName}`, // Used for graph lookups
        label: data.label || fileName.replace('.md', '').replace(/_/g, ' '),
        type: moduleType,
        icon: data.icon || (moduleType === 'playbook' ? 'SearchCode' : 'FileText'),
        data: data.data || parseMarkdownToModuleData(moduleType, content)
      };
    }));

    res.json({
      id: companyId,
      name: companyId.toUpperCase(),
      targetRole: companyId === 'mailin' ? 'L6 Staff Infrastructure Engineer' : 'Infrastructure & Pulumi Architect',
      brandColor: companyId === 'mailin' ? 'cyan' : 'indigo',
      modules: modules.sort((a, b) => a.id.localeCompare(b.id))
    });
  } catch (error) {
    res.status(404).json({ error: 'Company not found' });
  }
});

function parseMarkdownToModuleData(type, content) {
  if (type === 'list') {
    return [{
      category: 'Documentation',
      items: [{ title: 'Notes', desc: content.slice(0, 500) + '...', impact: 'Full view enabled.', solution: 'N/A' }]
    }];
  }
  if (type === 'playbook') {
    const sections = content.split(/\n###?\s+/);
    let q = 'Question content missing', trap = 'Trap content missing', why = 'Context missing', optimal = 'Solution missing';
    sections.forEach(section => {
      const s = section.trim();
      if (s.startsWith('Q:')) q = s.replace(/^Q:\s*/, '');
      if (s.startsWith('The Trap Response')) trap = s.replace(/^The Trap Response\s*/, '');
      if (s.startsWith('Why it fails')) why = s.replace(/^Why it fails\s*/, '');
      if (s.startsWith('Optimal Staff Response')) optimal = s.replace(/^Optimal Staff Response\s*/, '');
    });
    return [{ q, trap, trapWhy: why, optimal }];
  }
  return content;
}

// Catch-all route for SPA navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Sentinel Intelligence Engine active on port ${PORT}`);
});
