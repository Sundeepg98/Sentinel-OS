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

// Dynamic local source configuration
const LOCAL_SOURCES = {
  mailin: {
    basePath: path.join(__dirname, '..', 'mailin-data'), 
    folder: 'content'
  },
  turing: {
    basePath: path.join(__dirname, '..', 'turing-data'),
    folder: 'content'
  }
};

/**
 * Local Harvester: Scans directories and converts MD files to Modules
 */
app.get('/api/dossier/:companyId', async (req, res) => {
  const { companyId } = req.params;
  const source = LOCAL_SOURCES[companyId];

  if (!source) {
    return res.status(404).json({ error: 'Company source not found' });
  }

  try {
    const targetDir = path.join(source.basePath, source.folder);
    
    try {
      await fs.access(targetDir);
    } catch {
      return res.status(404).json({ error: `Directory not found: ${targetDir}` });
    }

    const files = await fs.readdir(targetDir);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    const modules = await Promise.all(mdFiles.map(async (fileName) => {
      const filePath = path.join(targetDir, fileName);
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
    }));

    res.json({
      id: companyId,
      name: companyId.toUpperCase(),
      targetRole: companyId === 'mailin' ? 'L6 Staff Infrastructure Engineer' : 'Infrastructure & Pulumi Architect',
      brandColor: companyId === 'mailin' ? 'cyan' : 'indigo',
      modules: modules.sort((a, b) => a.id.localeCompare(b.id))
    });

  } catch (error) {
    console.error('Local Harvest Error:', error.message);
    res.status(500).json({ error: 'Failed to harvest content locally' });
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
    // Robust parsing: Split by headers and match sections
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
  console.log(`Sentinel Harvester v3 active on port ${PORT}`);
});
