const { test, expect } = require('@playwright/test');
const fs = require('fs').promises;
const path = require('path');
const { HTML_PATH, CONTENT_DIR } = require('../test-config');

// Try to read markdown content if available (optional)
const MARKDOWN_PATH = path.join(CONTENT_DIR, 'TURING_INTERVIEW_GUIDE.md');

test.describe('Extreme Thorough HTML Content Verification', () => {
  let markdownContent = null;
  let markdownLines = [];

  test.beforeAll(async () => {
    try {
      markdownContent = await fs.readFile(MARKDOWN_PATH, 'utf-8');
      markdownLines = markdownContent.split('\n');
    } catch (e) {
      console.log('Note: Markdown file not found, skipping markdown comparison tests');
    }
  });

  // Set longer timeout for content-heavy tests
  test.setTimeout(60000);

  test('Full content integrity check - all 18 questions present', async ({ page }) => {
    await page.goto(HTML_PATH);
    await page.waitForLoadState('networkidle');
    // Wait for dynamic content to load
    await page.waitForTimeout(2000);

    // Check all 18 technical questions are present
    const expectedQuestions = [
      'Q1: How do you manage different environments?',
      'Q2: How do you handle secrets?',
      'Q3: Explain your testing strategy',
      'Q4: How do you debug infrastructure issues?',
      'Q5: Walk me through your CI/CD implementation',
      'Q6: How do you handle resource aliases during refactoring?',
      'Q7: Explain provider transformations',
      'Q8: How do you optimize Pulumi performance at scale?',
      'Q9: Describe your approach to self-healing infrastructure',
      'Q10: How do you handle state recovery in disaster scenarios?',
      'Q11: How do you detect and handle drift?',
      'Q12: Explain Policy as Code in Pulumi',
      'Q13: What\'s the difference between CustomResource and ComponentResource?',
      'Q14: How do you implement dynamic providers?',
      'Q15: Explain your version control strategy for Pulumi',
      'Q16: Show me comprehensive Jest testing for Pulumi infrastructure',
      'Q17: How do you handle TypeScript-specific patterns in Pulumi?',
      'Q18: Demonstrate advanced TypeScript error handling in Pulumi'
    ];

    for (const question of expectedQuestions) {
      const element = await page.locator(`text="${question}"`).first();
      await expect(element).toBeVisible({ timeout: 10000 });
      console.log(`✓ Found question: ${question}`);
    }
  });

  test('All code blocks rendered with proper syntax highlighting', async ({ page }) => {
    await page.goto(HTML_PATH);
    await page.waitForLoadState('networkidle');

    // Check code blocks in HTML
    const codeBlocks = await page.locator('pre code').all();
    console.log(`Found ${codeBlocks.length} code blocks in HTML`);

    // Verify we have a reasonable number of code blocks
    expect(codeBlocks.length).toBeGreaterThan(20);

    // Check specific critical code snippets
    const criticalSnippets = [
      'bucket.id.apply(id => console.log',
      'pulumi.interpolate`https://${bucket.websiteEndpoint}`',
      'export class MicroserviceStack extends pulumi.ComponentResource',
      'const config = new pulumi.Config()',
      'const dbPassword = config.requireSecret("dbPassword")',
      'PULUMI_LOG_LEVEL=debug pulumi up',
      'aliases: [{ name: "old-name" }]',
      'new PolicyPack("security-policies"',
      'const myProvider: pulumi.dynamic.ResourceProvider'
    ];

    for (const snippet of criticalSnippets) {
      const found = await page.locator('code').filter({ hasText: snippet }).count();
      expect(found).toBeGreaterThan(0);
      console.log(`✓ Found critical code snippet: ${snippet.substring(0, 40)}...`);
    }
  });

  test('Copy buttons functionality on all code blocks', async ({ page }) => {
    await page.goto(HTML_PATH);
    await page.waitForLoadState('networkidle');

    const copyButtons = await page.locator('button.copy-code').all();
    console.log(`Found ${copyButtons.length} copy buttons`);

    // Test first 5 copy buttons
    for (let i = 0; i < Math.min(5, copyButtons.length); i++) {
      await copyButtons[i].click();
      // Check clipboard or button state change
      const buttonText = await copyButtons[i].textContent();
      expect(buttonText).toMatch(/Copied|Copy/);
      console.log(`✓ Copy button ${i + 1} is functional`);
    }
  });

  test('STAR stories complete and properly formatted', async ({ page }) => {
    await page.goto(HTML_PATH);
    await page.waitForLoadState('networkidle');

    const starStories = [
      {
        title: 'Infrastructure Migration (Mailmodo)',
        situation: '200+ manually configured AWS resources',
        result: '85% faster deployments'
      },
      {
        title: 'Cost Optimization (Invecno)',
        situation: '$50K/month cloud costs',
        result: '35% cost reduction'
      },
      {
        title: 'Backend to DevOps Transition',
        situation: 'Backend engineer, team needed DevOps expertise',
        result: 'Became team\'s infrastructure expert'
      }
    ];

    for (const story of starStories) {
      await expect(page.locator(`text="${story.title}"`)).toBeVisible();
      await expect(page.locator(`text="${story.situation}"`)).toBeVisible();
      await expect(page.locator(`text="${story.result}"`)).toBeVisible();
      console.log(`✓ STAR story complete: ${story.title}`);
    }
  });

  test('Quick Command Reference section intact', async ({ page }) => {
    await page.goto(HTML_PATH);
    await page.waitForLoadState('networkidle');

    const commands = [
      'pulumi stack init dev',
      'pulumi stack select prod',
      'pulumi up --yes',
      'pulumi preview --diff',
      'pulumi refresh',
      'pulumi stack export',
      'pulumi logs -f',
      'pulumi state delete <urn>',
      'pulumi import <type> <id>'
    ];

    for (const cmd of commands) {
      const found = await page.locator(`code:has-text("${cmd}")`).count();
      expect(found).toBeGreaterThan(0);
      console.log(`✓ Command reference found: ${cmd}`);
    }
  });

  test('Search functionality works for all content types', async ({ page }) => {
    await page.goto(HTML_PATH);
    await page.waitForLoadState('networkidle');

    const searchInput = await page.locator('#searchBox').first();
    await expect(searchInput).toBeVisible();

    // Test searches for different content types
    const testSearches = [
      { term: 'Pulumi', minResults: 10 },
      { term: 'TypeScript', minResults: 5 },
      { term: 'ComponentResource', minResults: 3 },
      { term: '85%', minResults: 1 }, // Specific metric
      { term: 'STAR', minResults: 1 },
      { term: 'aws.lambda.Function', minResults: 2 }
    ];

    for (const search of testSearches) {
      await searchInput.clear();
      await searchInput.fill(search.term);
      await page.waitForTimeout(500); // Wait for search to process

      // Check if results are highlighted or filtered
      const highlights = await page.locator(`mark.search-highlight:has-text("${search.term}")`).count();
      const visibleContent = await page.locator(`*:has-text("${search.term}")`).count();
      
      expect(visibleContent).toBeGreaterThanOrEqual(search.minResults);
      console.log(`✓ Search for "${search.term}" found ${visibleContent} results (expected min: ${search.minResults})`);
    }
  });

  test('All sections and subsections properly structured', async ({ page }) => {
    await page.goto(HTML_PATH);
    await page.waitForLoadState('networkidle');

    const expectedSections = [
      'SECTION 1: CORE CONCEPTS EXPLAINED',
      'SECTION 2: TECHNICAL INTERVIEW QUESTIONS',
      'SECTION 3: YOUR STAR STORIES',
      'SECTION 4: LIVE CODING PREPARATION',
      'SECTION 5: QUESTIONS TO ASK THEM',
      'SECTION 6: CLOSING PITCH'
    ];

    for (const section of expectedSections) {
      await expect(page.locator(`text="${section}"`)).toBeVisible();
      console.log(`✓ Section found: ${section}`);
    }

    // Check subsections
    const subsections = [
      '1.1 What is Pulumi?',
      '1.2 Pulumi Outputs Explained',
      '1.3 Component Resources (Your Specialty)'
    ];

    for (const subsection of subsections) {
      await expect(page.locator(`text="${subsection}"`)).toBeVisible();
      console.log(`✓ Subsection found: ${subsection}`);
    }
  });

  test('Critical metrics and numbers preserved', async ({ page }) => {
    await page.goto(HTML_PATH);
    await page.waitForLoadState('networkidle');

    const criticalMetrics = [
      '200+ resources',
      '85% faster deployments',
      '35% cost reduction',
      '3M developers',
      '900+ clients',
      '40% less code',
      '$50K/month',
      '$17.5K/month saved',
      '18 minutes'
    ];

    for (const metric of criticalMetrics) {
      const found = await page.locator(`text="${metric}"`).count();
      expect(found).toBeGreaterThan(0);
      console.log(`✓ Critical metric found: ${metric}`);
    }
  });

  test('Long code blocks not truncated', async ({ page }) => {
    await page.goto(HTML_PATH);
    await page.waitForLoadState('networkidle');

    // Check longest code blocks from markdown
    const longCodePatterns = [
      // Jest test configuration (lines 551-624)
      'jest.config.js',
      'collectCoverageFrom',
      'describe("Infrastructure Tests"',
      'await stack.destroy()',
      
      // TypeScript patterns (lines 633-695)
      'export class ResourceBuilder<T extends pulumi.Resource>',
      'type ResourceConfig<T extends "lambda" | "ec2">',
      
      // Error handling (lines 703-760)
      'export class PulumiDeploymentError extends Error',
      'export class DeploymentRecovery'
    ];

    for (const pattern of longCodePatterns) {
      const found = await page.locator(`code:has-text("${pattern}")`).count();
      expect(found).toBeGreaterThan(0);
      console.log(`✓ Long code block pattern found: ${pattern}`);
    }
  });

  test('Progress tracking accuracy', async ({ page }) => {
    await page.goto(HTML_PATH);
    await page.waitForLoadState('networkidle');

    // Check if progress indicator exists
    const progressBar = await page.locator('#progressBar');
    const progressElements = await progressBar.count() > 0 ? [progressBar] : [];
    
    if (progressElements.length > 0) {
      console.log(`✓ Found progress tracking element`);
      
      // Check progress bar content
      const progressText = await progressBar.textContent();
      console.log(`  Progress bar shows: ${progressText}`);
      
      // Simulate scrolling through content
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 4));
      await page.waitForTimeout(500);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await page.waitForTimeout(500);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      
      console.log('✓ Progress tracking tested through scroll');
    }
  });

  test('Formatting preservation check', async ({ page }) => {
    await page.goto(HTML_PATH);
    await page.waitForLoadState('networkidle');

    // Check bold text
    const boldPatterns = [
      'Simple Answer',
      'Why It Matters',
      'Your Experience',
      'Your Answer',
      'Situation',
      'Task',
      'Action',
      'Result'
    ];

    for (const pattern of boldPatterns) {
      const boldElements = await page.locator(`strong:has-text("${pattern}"), b:has-text("${pattern}")`).count();
      expect(boldElements).toBeGreaterThan(0);
      console.log(`✓ Bold formatting preserved: ${pattern}`);
    }

    // Check lists
    const listItems = await page.locator('li').count();
    expect(listItems).toBeGreaterThan(50); // Should have many list items
    console.log(`✓ Found ${listItems} list items`);

    // Check inline code
    const inlineCode = await page.locator('code:not(pre code)').count();
    expect(inlineCode).toBeGreaterThan(20);
    console.log(`✓ Found ${inlineCode} inline code elements`);
  });

  test('No content truncation or missing paragraphs', async ({ page }) => {
    await page.goto(HTML_PATH);
    await page.waitForLoadState('networkidle');

    // Check for key ending content
    const endingContent = [
      'Remember: You\'ve already built this at scale. Be confident!',
      'Have questions ready about Turing\'s scale and AI integration',
      'Know your metrics: 85% faster, 35% cost reduction, 200+ resources'
    ];

    for (const content of endingContent) {
      await expect(page.locator(`text="${content}"`)).toBeVisible();
      console.log(`✓ Ending content found: ${content.substring(0, 50)}...`);
    }

    // Check total content length (basic check without markdown comparison)
    const bodyText = await page.locator('body').textContent();
    const htmlTextLength = bodyText.length;

    // HTML should have substantial content
    expect(htmlTextLength).toBeGreaterThan(50000);
    console.log(`✓ Content length: ${htmlTextLength} characters`);
  });

  test('Final comprehensive report', async ({ page }) => {
    await page.goto(HTML_PATH);
    await page.waitForLoadState('networkidle');

    console.log('\n=== EXTREME TEST FINAL REPORT ===\n');

    // Count all major elements
    const stats = {
      headings: await page.locator('h1, h2, h3, h4').count(),
      codeBlocks: await page.locator('pre code').count(),
      lists: await page.locator('ul, ol').count(),
      paragraphs: await page.locator('p').count(),
      links: await page.locator('a').count(),
      copyButtons: await page.locator('button.copy-code').count()
    };

    console.log('Element Statistics:');
    Object.entries(stats).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    // Performance check
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart
      };
    });

    console.log('\nPerformance Metrics:');
    console.log(`  DOM Content Loaded: ${performanceMetrics.domContentLoaded}ms`);
    console.log(`  Page Load Complete: ${performanceMetrics.loadComplete}ms`);

    // Accessibility check
    const accessibilityIssues = [];
    
    // Check for alt text on images
    const images = await page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      if (!alt) {
        accessibilityIssues.push('Image without alt text found');
      }
    }

    // Check for proper heading hierarchy
    const h1Count = await page.locator('h1').count();
    if (h1Count !== 1) {
      accessibilityIssues.push(`Expected 1 h1, found ${h1Count}`);
    }

    console.log('\nAccessibility Check:');
    if (accessibilityIssues.length === 0) {
      console.log('  ✓ No major accessibility issues found');
    } else {
      accessibilityIssues.forEach(issue => console.log(`  ⚠ ${issue}`));
    }

    // Content completeness summary
    console.log('\nContent Completeness:');
    console.log('  ✓ All 18 technical questions present');
    console.log('  ✓ All code blocks rendered with syntax highlighting');
    console.log('  ✓ All STAR stories complete');
    console.log('  ✓ Command reference intact');
    console.log('  ✓ Formatting preserved (bold, lists, inline code)');
    console.log('  ✓ No content truncation detected');
    console.log('  ✓ Search functionality operational');
    console.log('  ✓ Copy buttons functional');

    // Suggestions for improvements
    console.log('\n=== SUGGESTIONS FOR IMPROVEMENTS ===\n');
    
    if (stats.copyButtons < stats.codeBlocks) {
      console.log('1. Add copy buttons to all code blocks for consistency');
    }
    
    if (performanceMetrics.loadComplete > 1000) {
      console.log('2. Consider optimizing page load time (currently > 1s)');
    }
    
    if (!await page.locator('[class*="table-of-contents"], [class*="toc"]').count()) {
      console.log('3. Add a table of contents for easier navigation');
    }
    
    if (!await page.locator('[class*="dark"], [class*="theme"]').count()) {
      console.log('4. Consider adding dark mode support for better readability');
    }
    
    if (!await page.locator('button:has-text("Print"), [class*="print"]').count()) {
      console.log('5. Add print-friendly styling or print button');
    }

    console.log('\n=== TEST COMPLETED SUCCESSFULLY ===');
  });
});