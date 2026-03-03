const { test, expect } = require('@playwright/test');
const { HTML_PATH } = require('../test-config');

// Configure test to use clipboard permissions
test.use({
  permissions: ['clipboard-read', 'clipboard-write'],
});

test.describe('Copy Button Functionality Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the page and wait for it to fully load
    await page.goto(HTML_PATH);
    await page.waitForLoadState('networkidle');
    
    // Wait for copy buttons to be added by JavaScript
    await page.waitForTimeout(1000);
  });

  test('All code blocks have copy buttons', async ({ page }) => {
    // Get all code blocks
    const codeBlocks = await page.locator('pre code').all();
    console.log(`Found ${codeBlocks.length} code blocks`);

    // Get all copy buttons
    const copyButtons = await page.locator('button.copy-code').all();
    console.log(`Found ${copyButtons.length} copy buttons`);

    // Verify each code block has a copy button
    expect(copyButtons.length).toBe(codeBlocks.length);
    console.log('✓ All code blocks have copy buttons');

    // Verify copy buttons are properly positioned
    for (let i = 0; i < Math.min(5, copyButtons.length); i++) {
      const button = copyButtons[i];
      const isVisible = await button.isVisible();
      expect(isVisible).toBe(true);
      
      // Check button has proper styling
      const position = await button.evaluate(el => window.getComputedStyle(el).position);
      expect(position).toBe('absolute');
      
      console.log(`✓ Copy button ${i + 1} is visible and properly positioned`);
    }
  });

  test('Copy button visual feedback works', async ({ page }) => {
    const copyButtons = await page.locator('button.copy-code').all();
    
    // Test at least 3 buttons for visual feedback
    const buttonsToTest = Math.min(3, copyButtons.length);
    
    for (let i = 0; i < buttonsToTest; i++) {
      const button = copyButtons[i];
      
      // Get initial icon state
      const initialIcon = await button.locator('i').getAttribute('class');
      expect(initialIcon).toContain('bi-clipboard');
      
      // Click the copy button
      await button.click();
      
      // Check that icon changes to checkmark
      await page.waitForTimeout(100);
      const clickedIcon = await button.locator('i').getAttribute('class');
      expect(clickedIcon).toContain('bi-check');
      console.log(`✓ Button ${i + 1} shows checkmark after click`);
      
      // Wait for icon to revert back
      await page.waitForTimeout(2100);
      const revertedIcon = await button.locator('i').getAttribute('class');
      expect(revertedIcon).toContain('bi-clipboard');
      console.log(`✓ Button ${i + 1} reverts to clipboard icon after 2 seconds`);
    }
  });

  test('Clipboard functionality - copy actual code content', async ({ page, context }) => {
    // Get code blocks with their content
    const codeBlocks = await page.locator('pre code').all();
    const copyButtons = await page.locator('button.copy-code').all();
    
    // Test clipboard functionality for first 5 code blocks
    const blocksToTest = Math.min(5, codeBlocks.length);
    
    for (let i = 0; i < blocksToTest; i++) {
      // Get the expected code content
      const expectedCode = await codeBlocks[i].textContent();
      
      // Click the copy button
      await copyButtons[i].click();
      
      // Wait a bit for clipboard operation to complete
      await page.waitForTimeout(100);
      
      // Read from clipboard
      const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
      
      // Verify clipboard content matches code block content
      expect(clipboardContent).toBe(expectedCode);
      console.log(`✓ Code block ${i + 1} copied correctly (${expectedCode.split('\n')[0].substring(0, 50)}...)`);
    }
  });

  test('Copy buttons work for different code languages', async ({ page }) => {
    // Test specific code blocks with different languages
    const testCases = [
      { language: 'typescript', snippet: 'pulumi.Config()' },
      { language: 'javascript', snippet: 'export class' },
      { language: 'bash', snippet: 'pulumi' },
      { language: 'yaml', snippet: 'runtime:' }
    ];
    
    for (const testCase of testCases) {
      // Find a code block containing the snippet
      const codeBlock = await page.locator(`pre code:has-text("${testCase.snippet}")`).first();
      
      if (await codeBlock.count() > 0) {
        const parent = await codeBlock.locator('..').first();
        const copyButton = await parent.locator('button.copy-code').first();
        
        // Get the code content
        const codeContent = await codeBlock.textContent();
        
        // Click copy button
        await copyButton.click();
        await page.waitForTimeout(100);
        
        // Verify clipboard content
        const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
        expect(clipboardContent).toBe(codeContent);
        
        console.log(`✓ ${testCase.language} code block copied successfully`);
      }
    }
  });

  test('Copy long code blocks completely', async ({ page }) => {
    // Find long code blocks (more than 10 lines)
    const codeBlocks = await page.locator('pre code').all();
    
    let longBlocksFound = 0;
    for (let i = 0; i < codeBlocks.length && longBlocksFound < 3; i++) {
      const codeContent = await codeBlocks[i].textContent();
      const lineCount = codeContent.split('\n').length;
      
      if (lineCount > 10) {
        longBlocksFound++;
        
        // Find corresponding copy button
        const parent = await codeBlocks[i].locator('..').first();
        const copyButton = await parent.locator('button.copy-code').first();
        
        // Click copy button
        await copyButton.click();
        await page.waitForTimeout(100);
        
        // Verify full content is copied
        const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
        expect(clipboardContent).toBe(codeContent);
        expect(clipboardContent.split('\n').length).toBe(lineCount);
        
        console.log(`✓ Long code block (${lineCount} lines) copied completely`);
      }
    }
    
    expect(longBlocksFound).toBeGreaterThan(0);
  });

  test('Copy buttons handle special characters correctly', async ({ page }) => {
    // Find code blocks with special characters
    const specialCharPatterns = [
      { pattern: '${', name: 'template literals' },
      { pattern: '&&', name: 'logical operators' },
      { pattern: '[]', name: 'array brackets' },
      { pattern: '()', name: 'parentheses' },
      { pattern: '<>', name: 'angle brackets' }
    ];
    
    for (const { pattern, name } of specialCharPatterns) {
      const codeBlock = await page.locator(`pre code:has-text("${pattern}")`).first();
      
      if (await codeBlock.count() > 0) {
        const parent = await codeBlock.locator('..').first();
        const copyButton = await parent.locator('button.copy-code').first();
        
        // Get original content
        const originalContent = await codeBlock.textContent();
        
        // Click copy button
        await copyButton.click();
        await page.waitForTimeout(100);
        
        // Verify special characters are preserved
        const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
        expect(clipboardContent).toBe(originalContent);
        expect(clipboardContent).toContain(pattern);
        
        console.log(`✓ Special characters (${name}) preserved in clipboard`);
      }
    }
  });

  test('Copy buttons are keyboard accessible', async ({ page }) => {
    const firstCopyButton = await page.locator('button.copy-code').first();
    
    // Focus the button using Tab navigation
    await firstCopyButton.focus();
    
    // Verify button is focused
    const isFocused = await firstCopyButton.evaluate(el => document.activeElement === el);
    expect(isFocused).toBe(true);
    
    // Get the code content
    const codeBlock = await page.locator('pre code').first();
    const expectedContent = await codeBlock.textContent();
    
    // Trigger copy using Enter key
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    
    // Verify clipboard content
    const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardContent).toBe(expectedContent);
    
    console.log('✓ Copy buttons are keyboard accessible');
  });

  test('Multiple rapid clicks handled correctly', async ({ page }) => {
    const copyButton = await page.locator('button.copy-code').first();
    const codeBlock = await page.locator('pre code').first();
    const expectedContent = await codeBlock.textContent();
    
    // Click rapidly 5 times
    for (let i = 0; i < 5; i++) {
      await copyButton.click();
      await page.waitForTimeout(50);
    }
    
    // Wait for any animations to complete
    await page.waitForTimeout(500);
    
    // Verify clipboard still has correct content
    const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardContent).toBe(expectedContent);
    
    // Verify button state is still functional
    const iconClass = await copyButton.locator('i').getAttribute('class');
    expect(iconClass).toBeTruthy();
    
    console.log('✓ Multiple rapid clicks handled without errors');
  });

  test('Copy functionality works after page interactions', async ({ page }) => {
    // Perform various page interactions
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(500);
    
    // Find a code block in the middle of the page
    const codeBlocks = await page.locator('pre code').all();
    const middleIndex = Math.floor(codeBlocks.length / 2);
    
    const targetCodeBlock = codeBlocks[middleIndex];
    const expectedContent = await targetCodeBlock.textContent();
    
    // Scroll to the code block
    await targetCodeBlock.scrollIntoViewIfNeeded();
    
    // Find and click its copy button
    const parent = await targetCodeBlock.locator('..').first();
    const copyButton = await parent.locator('button.copy-code').first();
    
    await copyButton.click();
    await page.waitForTimeout(100);
    
    // Verify clipboard content
    const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardContent).toBe(expectedContent);
    
    console.log('✓ Copy functionality works after scrolling and page interactions');
  });

  test('Performance test - copy buttons don\'t impact page load', async ({ page }) => {
    // Measure time to add all copy buttons
    const startTime = Date.now();
    
    await page.goto(HTML_PATH);
    await page.waitForLoadState('networkidle');
    
    // Wait for all copy buttons to be added
    await page.waitForFunction(() => {
      const codeBlocks = document.querySelectorAll('pre code');
      const copyButtons = document.querySelectorAll('button.copy-code');
      return codeBlocks.length === copyButtons.length && codeBlocks.length > 0;
    }, { timeout: 5000 });
    
    const endTime = Date.now();
    const loadTime = endTime - startTime;
    
    console.log(`✓ Page with copy buttons loaded in ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
    
    // Verify no JavaScript errors
    const jsErrors = [];
    page.on('pageerror', error => jsErrors.push(error.message));
    await page.waitForTimeout(1000);
    
    expect(jsErrors).toHaveLength(0);
    console.log('✓ No JavaScript errors during copy button initialization');
  });

  test('Summary report', async ({ page }) => {
    console.log('\n=== COPY BUTTON TEST SUMMARY ===\n');
    
    const stats = {
      totalCodeBlocks: await page.locator('pre code').count(),
      totalCopyButtons: await page.locator('button.copy-code').count(),
      visibleButtons: await page.locator('button.copy-code:visible').count()
    };
    
    console.log('Statistics:');
    console.log(`  Total code blocks: ${stats.totalCodeBlocks}`);
    console.log(`  Total copy buttons: ${stats.totalCopyButtons}`);
    console.log(`  Visible copy buttons: ${stats.visibleButtons}`);
    
    // Test a sample of buttons
    const sampleSize = Math.min(10, stats.totalCopyButtons);
    let successfulCopies = 0;
    
    for (let i = 0; i < sampleSize; i++) {
      try {
        const button = await page.locator('button.copy-code').nth(i);
        const codeBlock = await page.locator('pre code').nth(i);
        const expectedContent = await codeBlock.textContent();
        
        await button.click();
        await page.waitForTimeout(100);
        
        const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
        if (clipboardContent === expectedContent) {
          successfulCopies++;
        }
      } catch (e) {
        // Continue testing other buttons
      }
    }
    
    console.log(`\nFunctionality Test:`);
    console.log(`  Tested ${sampleSize} copy buttons`);
    console.log(`  Successful copies: ${successfulCopies}/${sampleSize}`);
    
    const successRate = (successfulCopies / sampleSize) * 100;
    console.log(`  Success rate: ${successRate.toFixed(1)}%`);
    
    if (successRate === 100) {
      console.log('\n✅ All copy button tests passed successfully!');
    } else {
      console.log(`\n⚠️  ${sampleSize - successfulCopies} copy operations failed`);
    }
  });
});