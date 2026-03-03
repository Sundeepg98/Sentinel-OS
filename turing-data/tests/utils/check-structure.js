const fs = require('fs');
const { JSDOM } = require('jsdom');

// Read the HTML file
const html = fs.readFileSync('index.html', 'utf8');

// Create a DOM
const dom = new JSDOM(html, {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true
});

const { window } = dom;
const { document } = window;

// Wait for DOM to be ready
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        console.log('🔍 Checking HTML structure...\n');
        
        // Check for key elements
        const checks = {
            'Markdown content script': !!document.getElementById('markdownContent'),
            'Content container': !!document.getElementById('contentContainer'),
            'Sidebar nav': !!document.getElementById('sidebarNav'),
            'Search box': !!document.getElementById('searchBox'),
            'Dark mode toggle': !!document.getElementById('darkModeToggle'),
            'Question count': !!document.getElementById('questionCount'),
            'Progress bar': !!document.getElementById('progressBar')
        };
        
        console.log('📋 Element Checks:');
        Object.entries(checks).forEach(([name, exists]) => {
            console.log(`  ${exists ? '✅' : '❌'} ${name}`);
        });
        
        // Check if renderer initialized
        console.log('\n📊 Content Analysis:');
        const contentContainer = document.getElementById('contentContainer');
        console.log(`  Content length: ${contentContainer.innerHTML.length} characters`);
        
        const questions = document.querySelectorAll('.question-card');
        console.log(`  Questions rendered: ${questions.length}/18`);
        
        const codeBlocks = document.querySelectorAll('pre code');
        console.log(`  Code blocks: ${codeBlocks.length}`);
        
        const copyButtons = document.querySelectorAll('.copy-code');
        console.log(`  Copy buttons: ${copyButtons.length}`);
        
        const navItems = document.querySelectorAll('#sidebarNav .nav-link');
        console.log(`  Navigation items: ${navItems.length}`);
        
        // Check markdown content
        const markdownScript = document.getElementById('markdownContent');
        if (markdownScript) {
            const markdownLength = markdownScript.textContent.length;
            console.log(`\n📄 Markdown content: ${markdownLength} characters`);
            
            // Count questions in markdown
            const questionMatches = markdownScript.textContent.match(/### Q\d+:/g);
            console.log(`  Questions in markdown: ${questionMatches ? questionMatches.length : 0}`);
        }
        
        // Success calculation
        const success = questions.length === 18 && codeBlocks.length > 30 && copyButtons.length > 30;
        console.log(`\n${success ? '✅ SUCCESS' : '❌ FAILED'}: Page ${success ? 'is' : 'is NOT'} fully rendered`);
        
        dom.window.close();
    }, 2000);
});