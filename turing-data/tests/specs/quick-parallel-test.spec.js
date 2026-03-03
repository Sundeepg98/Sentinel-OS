const { test, expect } = require('@playwright/test');
const { HTML_PATH } = require('../test-config');

// Test only on chromium for speed
test.describe.configure({ mode: 'parallel' });

test.describe('Quick Parallel Tests @chromium', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    // Only run on chromium
    if (testInfo.project.name !== 'chromium') {
      test.skip();
    }
    await page.goto(HTML_PATH);
  });

  test('Core elements exist', async ({ page }) => {
    await expect(page.locator('#searchBox')).toBeVisible();
    await expect(page.locator('#darkModeToggle')).toBeVisible();
    await expect(page.locator('#sidebarNav')).toBeVisible();
    await expect(page.locator('#contentContainer')).toBeVisible();
    await expect(page.locator('#progressBar')).toBeVisible();
  });

  test('Search works', async ({ page }) => {
    await page.locator('#searchBox').fill('Pulumi');
    await page.waitForTimeout(300);
    const highlights = await page.locator('mark.search-highlight').count();
    expect(highlights).toBeGreaterThan(0);
  });

  test('Dark mode toggles', async ({ page }) => {
    const toggle = page.locator('#darkModeToggle');
    await toggle.click();
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'dark');
  });

  test('Navigation clicks work', async ({ page }) => {
    const firstLink = page.locator('#sidebarNav a').first();
    await firstLink.click();
    await page.waitForTimeout(300);
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);
  });

  test('Questions are loaded', async ({ page }) => {
    const questions = await page.locator('.question-card').count();
    expect(questions).toBeGreaterThanOrEqual(18);
  });

  test('Code blocks exist', async ({ page }) => {
    const codeBlocks = await page.locator('pre code').count();
    expect(codeBlocks).toBeGreaterThan(0);
  });

  test('Copy buttons exist', async ({ page }) => {
    const copyButtons = await page.locator('.copy-code').count();
    expect(copyButtons).toBeGreaterThan(0);
  });

  test('No console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('Mobile menu exists', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const mobileToggle = page.locator('.navbar-toggler');
    await expect(mobileToggle).toBeVisible();
  });

  test('STAR stories present', async ({ page }) => {
    const pageText = await page.textContent('body');
    expect(pageText).toContain('Situation:');
    expect(pageText).toContain('Task:');
    expect(pageText).toContain('Action:');
    expect(pageText).toContain('Result:');
  });
});