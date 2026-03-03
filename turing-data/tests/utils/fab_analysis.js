// FAB Analysis Script
// This script analyzes the FAB implementation in index.html

const fs = require('fs');
const path = require('path');

// Read the HTML file
const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

console.log('=== FAB IMPLEMENTATION ANALYSIS ===\n');

// 1. Check FAB Container Creation
console.log('1. FAB CONTAINER CREATION:');
const fabContainerMatch = htmlContent.match(/const fabContainer = document\.createElement\('div'\);[\s\S]*?document\.body\.appendChild\(fabContainer\);/);
if (fabContainerMatch) {
    console.log('✓ FAB container is dynamically created and appended to document.body');
    
    // Check if className is set
    if (htmlContent.includes("fabContainer.className = 'fab-container'")) {
        console.log('✓ FAB container has correct class name: fab-container');
    }
    
    // Check innerHTML content
    const innerHTMLMatch = htmlContent.match(/fabContainer\.innerHTML = `([\s\S]*?)`;/);
    if (innerHTMLMatch) {
        const innerHTML = innerHTMLMatch[1];
        console.log('✓ FAB container innerHTML is set with template literal');
        
        // Check for buttons
        const scrollToTopMatch = innerHTML.match(/<button[^>]*id="scrollToTop"[^>]*>/);
        const quickNavMatch = innerHTML.match(/<button[^>]*id="quickNavFab"[^>]*>/);
        
        console.log(scrollToTopMatch ? '✓ scrollToTop button found in template' : '✗ scrollToTop button not found');
        console.log(quickNavMatch ? '✓ quickNavFab button found in template' : '✗ quickNavFab button not found');
    }
}

console.log('\n2. CSS STYLES:');
// Check FAB container styles
const fabContainerStyles = htmlContent.match(/\.fab-container\s*{([^}]*)}/);
if (fabContainerStyles) {
    const styles = fabContainerStyles[1];
    console.log('✓ .fab-container styles found:');
    console.log(styles.trim().split('\n').map(s => '  ' + s.trim()).join('\n'));
    
    // Check specific properties
    console.log('\nPosition checks:');
    console.log(styles.includes('position: fixed') ? '✓ position: fixed' : '✗ position not fixed');
    console.log(styles.includes('bottom: 30px') ? '✓ bottom: 30px' : '✗ bottom not 30px');
    console.log(styles.includes('right: 30px') ? '✓ right: 30px' : '✗ right not 30px');
}

// Check FAB button styles
const fabStyles = htmlContent.match(/\.fab\s*{([^}]*)}/);
if (fabStyles) {
    console.log('\n✓ .fab styles found');
}

// Check FAB hover styles
const fabHoverStyles = htmlContent.match(/\.fab:hover\s*{([^}]*)}/);
if (fabHoverStyles) {
    const hoverStyles = fabHoverStyles[1];
    console.log('\n✓ .fab:hover styles found:');
    console.log(hoverStyles.trim().split('\n').map(s => '  ' + s.trim()).join('\n'));
    
    console.log('\nHover animation check:');
    console.log(hoverStyles.includes('transform: scale(1.1)') ? '✓ transform: scale(1.1)' : '✗ scale not 1.1');
}

console.log('\n3. FUNCTIONALITY:');
// Check scrollToTop functionality
const scrollToTopFunc = htmlContent.match(/document\.getElementById\('scrollToTop'\)\.addEventListener\('click'[\s\S]*?\}\);/);
if (scrollToTopFunc) {
    console.log('✓ scrollToTop click event listener found');
    if (scrollToTopFunc[0].includes('window.scrollTo')) {
        console.log('✓ Uses window.scrollTo for scrolling');
        if (scrollToTopFunc[0].includes('behavior: \'smooth\'')) {
            console.log('✓ Smooth scrolling enabled');
        }
    }
}

// Check quickNavFab functionality
const quickNavFunc = htmlContent.match(/document\.getElementById\('quickNavFab'\)\.addEventListener\('click'[\s\S]*?\}\);/);
if (quickNavFunc) {
    console.log('\n✓ quickNavFab click event listener found');
    
    // Check modal creation
    if (quickNavFunc[0].includes('createElement(\'div\')')) {
        console.log('✓ Creates modal element');
    }
    if (quickNavFunc[0].includes('modal fade')) {
        console.log('✓ Uses Bootstrap modal classes');
    }
    if (quickNavFunc[0].includes('new bootstrap.Modal')) {
        console.log('✓ Initializes Bootstrap modal');
    }
    if (quickNavFunc[0].includes('modal.show()')) {
        console.log('✓ Shows modal on click');
    }
}

console.log('\n4. BOOTSTRAP ICONS:');
// Check for Bootstrap Icons usage
if (htmlContent.includes('bi bi-arrow-up')) {
    console.log('✓ scrollToTop uses Bootstrap Icon: bi-arrow-up');
}
if (htmlContent.includes('bi bi-compass')) {
    console.log('✓ quickNavFab uses Bootstrap Icon: bi-compass');
}

console.log('\n=== ANALYSIS COMPLETE ===');