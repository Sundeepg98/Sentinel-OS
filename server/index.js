const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const INTELLIGENCE_DIR = path.join(__dirname, '..', 'intelligence');

/**
 * 1. Company Discovery: Scans /intelligence for sub-folders
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
 * 2. Harvester: Scans specific company folder for MD files
 */
app.get('/api/dossier/:companyId', async (req, res) => {
  const { companyId } = req.params;
  const companyDir = path.join(INTELLIGENCE_DIR, companyId);

  try {
    await fs.access(companyDir);
    const files = await fs.readdir(companyDir);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    const modules = await Promise.all(mdFiles.map(async (fileName) => {
      try {
        const filePath = path.join(companyDir, fileName);
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const { data, content } = matter(fileContent);
        
        const moduleType = data.type || 'markdown';

        return {
          id: fileName.replace('.md', '').toLowerCase(),
          label: data.label || fileName.replace('.md', '').replace(/_/g, ' '),
          type: moduleType,
          icon: data.icon || (moduleType === 'playbook' ? 'SearchCode' : 'FileText'),
          data: data.data || parseMarkdownToModuleData(moduleType, content)
        };
      } catch (e) {
        console.error(`Skipping malformed file: ${fileName}`, e.message);
        return null;
      }
    }));

    // Filter out any failed parses
    const validModules = modules.filter(m => m !== null);

    res.json({
      id: companyId,
      name: companyId.toUpperCase(),
      // Dynamic role determination (could be moved to a company-config.json per folder)
      targetRole: companyId === 'mailin' ? 'L6 Staff Infrastructure Engineer' : 'Infrastructure & Pulumi Architect',
      brandColor: companyId === 'mailin' ? 'cyan' : 'indigo',
      modules: validModules.sort((a, b) => a.id.localeCompare(b.id))
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
    let q = 'Question content missing';
    let trap = 'Trap content missing';
    let why = 'Context missing';
    let optimal = 'Solution missing';

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

app.listen(PORT, () => {
  console.log(`Sentinel Autonomous Harvester active on port ${PORT}`);
});
