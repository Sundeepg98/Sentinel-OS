function parsePlaybook(content) {
  const sections = content.split(/## Q:/).filter(s => s.trim().length > 0);
  return sections.map(s => {
    const lines = s.split('\n');
    const question = lines[0].trim();
    const trapMatch = s.match(/### The Trap Response\r?\n([\s\S]*?)(?=###|$)/i);
    const whyMatch = s.match(/### Why it fails\r?\n([\s\S]*?)(?=###|$)/i);
    const optimalMatch = s.match(/### Optimal Staff Response\r?\n([\s\S]*?)(?=###|$)/i);
    return { q: question, trap: trapMatch ? trapMatch[1].trim() : "", trapWhy: whyMatch ? whyMatch[1].trim() : "", optimal: optimalMatch ? optimalMatch[1].trim() : "" };
  }).filter(p => p.q);
}

function parseChecklist(content) {
  const lines = content.split('\n');
  let id = 1;
  return lines.filter(l => l.trim().startsWith('-')).map(l => ({ id: id++, text: l.replace(/^-\s*(\[[\sxX]\])?\s*/, '').trim(), done: l.includes('[x]') || l.includes('[X]') })).filter(t => t.text.length > 0);
}

module.exports = { parsePlaybook, parseChecklist };
