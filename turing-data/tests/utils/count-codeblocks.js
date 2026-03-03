const fs = require('fs');

// Read the HTML file
const html = fs.readFileSync('index.html', 'utf8');

// Extract markdown content
const markdownMatch = html.match(/<script id="markdownContent" type="text\/markdown">([\s\S]*?)<\/script>/);
if (markdownMatch) {
    const markdown = markdownMatch[1];
    
    // Count code blocks by section
    console.log('📊 Code Block Analysis:');
    console.log('====================\n');
    
    // Section 1: Core Concepts
    const coreConceptsMatch = markdown.match(/## SECTION 1: CORE CONCEPTS EXPLAINED([\s\S]*?)## SECTION 2:/);
    if (coreConceptsMatch) {
        const coreBlocks = (coreConceptsMatch[1].match(/```/g) || []).length / 2;
        console.log(`Section 1 (Core Concepts): ${coreBlocks} code blocks`);
    }
    
    // Questions
    const questionsMatch = markdown.match(/## SECTION 2: TECHNICAL INTERVIEW QUESTIONS([\s\S]*?)## SECTION 3:/);
    if (questionsMatch) {
        const questionBlocks = (questionsMatch[1].match(/```/g) || []).length / 2;
        console.log(`Section 2 (Questions): ${questionBlocks} code blocks`);
    }
    
    // Live Coding
    const liveCodingMatch = markdown.match(/## SECTION 4: LIVE CODING PREPARATION([\s\S]*?)## SECTION 5:/);
    if (liveCodingMatch) {
        const liveBlocks = (liveCodingMatch[1].match(/```/g) || []).length / 2;
        console.log(`Section 4 (Live Coding): ${liveBlocks} code blocks`);
    }
    
    // Commands
    const commandsMatch = markdown.match(/## QUICK COMMAND REFERENCE([\s\S]*?)## RED FLAGS/);
    if (commandsMatch) {
        const commandBlocks = (commandsMatch[1].match(/```/g) || []).length / 2;
        console.log(`Commands Section: ${commandBlocks} code blocks`);
    }
    
    // Total
    const totalBlocks = (markdown.match(/```/g) || []).length / 2;
    console.log(`\nTotal code blocks in markdown: ${totalBlocks}`);
    
    // Check what's being rendered
    const renderedBlocks = (html.match(/<pre><code/g) || []).length;
    console.log(`Code blocks rendered in HTML: ${renderedBlocks}`);
    
    console.log(`\n${renderedBlocks >= 30 ? '✅' : '❌'} Target: 30+ code blocks`);
}