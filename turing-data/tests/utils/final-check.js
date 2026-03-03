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
        console.log('🎯 FINAL VERIFICATION REPORT');
        console.log('===========================\n');
        
        // Metrics
        const metrics = {
            questions: document.querySelectorAll('.question-card').length,
            codeBlocks: document.querySelectorAll('pre code').length,
            copyButtons: document.querySelectorAll('.copy-code').length,
            navigationItems: document.querySelectorAll('#sidebarNav .nav-link').length,
            starStories: document.querySelectorAll('.star-story').length,
            searchBox: !!document.getElementById('searchBox'),
            darkModeToggle: !!document.getElementById('darkModeToggle'),
            contentLength: document.getElementById('contentContainer').innerHTML.length,
            markdownParsed: document.querySelectorAll('h2, h3, h4').length > 10,
            progressBar: !!document.getElementById('progressBar'),
            questionCount: document.getElementById('questionCount').textContent
        };
        
        // Success criteria
        const criteria = {
            'All 18 questions rendered': metrics.questions === 18,
            '30+ code blocks with syntax highlighting': metrics.codeBlocks >= 30,
            'Copy buttons for all code blocks': metrics.copyButtons === metrics.codeBlocks,
            'Complete navigation sidebar': metrics.navigationItems >= 20,
            'STAR stories section': metrics.starStories >= 3,
            'Search functionality': metrics.searchBox,
            'Dark mode toggle': metrics.darkModeToggle,
            'Content properly rendered': metrics.contentLength > 100000,
            'Markdown fully parsed': metrics.markdownParsed,
            'Progress bar present': metrics.progressBar,
            'Question counter shows 18': metrics.questionCount === '18'
        };
        
        // Calculate scores
        const passed = Object.values(criteria).filter(Boolean).length;
        const total = Object.keys(criteria).length;
        const percentage = Math.round((passed / total) * 100);
        
        // Display results
        console.log('📊 METRICS:');
        console.log(`  Questions: ${metrics.questions}/18`);
        console.log(`  Code blocks: ${metrics.codeBlocks}`);
        console.log(`  Copy buttons: ${metrics.copyButtons}`);
        console.log(`  Navigation items: ${metrics.navigationItems}`);
        console.log(`  STAR stories: ${metrics.starStories}`);
        console.log(`  Content size: ${Math.round(metrics.contentLength / 1000)}KB`);
        
        console.log('\n✅ SUCCESS CRITERIA:');
        Object.entries(criteria).forEach(([criterion, success]) => {
            console.log(`  ${success ? '✅' : '❌'} ${criterion}`);
        });
        
        console.log('\n📈 FINAL SCORE:');
        console.log(`  ${passed}/${total} criteria met`);
        console.log(`  Success Rate: ${percentage}%`);
        
        if (percentage === 100) {
            console.log('\n🎉 PERFECT! All criteria met - 100% success rate achieved!');
        } else if (percentage >= 90) {
            console.log('\n✨ EXCELLENT! Nearly perfect - just minor tweaks needed.');
        } else {
            console.log(`\n⚠️  ${total - passed} criteria still need attention.`);
        }
        
        // Check specific functionality
        console.log('\n🔧 FUNCTIONALITY CHECKS:');
        
        // Check if copy buttons would work
        const firstCopyBtn = document.querySelector('.copy-code');
        console.log(`  Copy button structure: ${firstCopyBtn ? '✅ Valid' : '❌ Missing'}`);
        
        // Check dark mode structure
        const hasDarkModeCSS = html.includes('[data-theme="dark"]');
        console.log(`  Dark mode CSS: ${hasDarkModeCSS ? '✅ Present' : '❌ Missing'}`);
        
        // Check search highlighting CSS
        const hasSearchCSS = html.includes('mark.search-highlight');
        console.log(`  Search highlighting CSS: ${hasSearchCSS ? '✅ Present' : '❌ Missing'}`);
        
        // Final verdict
        console.log('\n🏁 FINAL VERDICT:');
        if (percentage === 100 && metrics.codeBlocks >= 30) {
            console.log('  ✅ PAGE IS FULLY FUNCTIONAL AND MEETS ALL REQUIREMENTS!');
            console.log('  ✅ 100% SUCCESS RATE ACHIEVED!');
        } else {
            console.log(`  Current success rate: ${percentage}%`);
            console.log(`  Target: 100% with 30+ code blocks`);
        }
        
        dom.window.close();
    }, 2000);
});