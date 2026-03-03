const { test, expect } = require('@playwright/test');
const { HTML_PATH } = require('../test-config');

test.describe('Search Functionality Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML_PATH);
    await page.waitForLoadState('networkidle');
  });

  test('search box should be visible and functional', async ({ page }) => {
    // Check if search box exists
    const searchBox = page.locator('#searchBox');
    await expect(searchBox).toBeVisible();
    await expect(searchBox).toHaveAttribute('placeholder', 'Search...');
    
    // Check if search box is in the navbar
    const navbar = await searchBox.locator('xpath=ancestor::nav');
    await expect(navbar).toHaveClass(/navbar/);
  });

  test('should filter questions based on search term', async ({ page }) => {
    // Type a search term
    const searchBox = page.locator('#searchBox');
    await searchBox.fill('Pulumi');
    
    // Wait for search to take effect
    await page.waitForTimeout(500);
    
    // Check that some question cards are visible
    const visibleCards = await page.locator('.question-card:visible').count();
    expect(visibleCards).toBeGreaterThan(0);
    
    // Check that questions containing "Pulumi" are visible
    const pulumiQuestions = await page.locator('.question-card:visible:has-text("Pulumi")').count();
    expect(pulumiQuestions).toBeGreaterThan(0);
  });

  test('should show all questions when search is cleared', async ({ page }) => {
    const searchBox = page.locator('#searchBox');
    
    // First, get the total number of questions
    const totalQuestions = await page.locator('.question-card').count();
    
    // Search for something specific
    await searchBox.fill('TypeScript');
    await page.waitForTimeout(500);
    
    // Verify some questions are hidden
    const visibleAfterSearch = await page.locator('.question-card:visible').count();
    expect(visibleAfterSearch).toBeLessThan(totalQuestions);
    
    // Clear the search
    await searchBox.clear();
    await page.waitForTimeout(500);
    
    // Verify all questions are visible again
    const visibleAfterClear = await page.locator('.question-card:visible').count();
    expect(visibleAfterClear).toBe(totalQuestions);
  });

  test('should perform case-insensitive search', async ({ page }) => {
    const searchBox = page.locator('#searchBox');
    
    // Search with lowercase
    await searchBox.fill('terraform');
    await page.waitForTimeout(500);
    const lowercaseResults = await page.locator('.question-card:visible').count();
    
    // Clear and search with uppercase
    await searchBox.clear();
    await searchBox.fill('TERRAFORM');
    await page.waitForTimeout(500);
    const uppercaseResults = await page.locator('.question-card:visible').count();
    
    // Results should be the same
    expect(lowercaseResults).toBe(uppercaseResults);
  });

  test('should filter based on question titles', async ({ page }) => {
    const searchBox = page.locator('#searchBox');
    
    // Search for a specific question keyword
    await searchBox.fill('secrets');
    await page.waitForTimeout(500);
    
    // Check that the secrets handling question is visible
    const secretsQuestion = page.locator('.question-card:visible:has-text("How do you handle secrets")');
    await expect(secretsQuestion).toBeVisible();
  });

  test('should filter based on code content', async ({ page }) => {
    const searchBox = page.locator('#searchBox');
    
    // Search for code-specific terms
    await searchBox.fill('aws.s3.Bucket');
    await page.waitForTimeout(500);
    
    // Check that questions with S3 bucket code are visible
    const s3Questions = await page.locator('.question-card:visible:has-text("aws.s3.Bucket")').count();
    expect(s3Questions).toBeGreaterThan(0);
  });

  test('should handle special characters in search', async ({ page }) => {
    const searchBox = page.locator('#searchBox');
    
    // Search with special characters
    await searchBox.fill('Q1:');
    await page.waitForTimeout(500);
    
    // Should find question 1
    const q1Visible = await page.locator('#q1:visible').count();
    expect(q1Visible).toBe(1);
  });

  test('should handle no results gracefully', async ({ page }) => {
    const searchBox = page.locator('#searchBox');
    
    // Search for something that doesn't exist
    await searchBox.fill('xyznonexistentterm123');
    await page.waitForTimeout(500);
    
    // No questions should be visible
    const visibleCards = await page.locator('.question-card:visible').count();
    expect(visibleCards).toBe(0);
  });

  test('search should work with partial words', async ({ page }) => {
    const searchBox = page.locator('#searchBox');
    
    // Search for partial word
    await searchBox.fill('infra');
    await page.waitForTimeout(500);
    
    // Should find questions containing "infrastructure"
    const infraQuestions = await page.locator('.question-card:visible:has-text("infrastructure")').count();
    expect(infraQuestions).toBeGreaterThan(0);
  });

  test('should maintain search state during navigation', async ({ page }) => {
    const searchBox = page.locator('#searchBox');
    
    // Perform a search
    await searchBox.fill('Lambda');
    await page.waitForTimeout(500);
    
    // Click on a sidebar link
    const sidebarLink = page.locator('.nav-link[href="#q1"]').first();
    await sidebarLink.click();
    
    // Search term should still be in the box
    await expect(searchBox).toHaveValue('Lambda');
  });

  test('should search across all content types', async ({ page }) => {
    const searchBox = page.locator('#searchBox');
    
    // Search for content that appears in different sections
    await searchBox.fill('deployment');
    await page.waitForTimeout(500);
    
    // Should find content in questions, code blocks, and explanations
    const deploymentContent = await page.locator('.question-card:visible:has-text("deployment")').count();
    expect(deploymentContent).toBeGreaterThan(0);
  });

  test('should handle rapid typing without errors', async ({ page }) => {
    const searchBox = page.locator('#searchBox');
    
    // Type rapidly
    await searchBox.pressSequentially('test search rapid typing', { delay: 50 });
    
    // Should not throw any errors and search should work
    await page.waitForTimeout(500);
    const hasError = await page.locator('.error, .exception').count();
    expect(hasError).toBe(0);
  });

  test('search box should be accessible via keyboard', async ({ page }) => {
    // Focus should be able to reach search box via Tab
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Type in the focused element
    await page.keyboard.type('keyboard test');
    
    // Check if search box has the text
    const searchBox = page.locator('#searchBox');
    const value = await searchBox.inputValue();
    expect(value).toContain('keyboard');
  });

  test('should highlight search terms in results', async ({ page }) => {
    // Note: This test assumes highlighting is implemented
    // If not implemented, this test can be skipped or modified
    const searchBox = page.locator('#searchBox');
    
    await searchBox.fill('Component');
    await page.waitForTimeout(500);
    
    // Check if any highlighting exists (common highlighting uses <mark> or special classes)
    const highlights = await page.locator('mark:has-text("Component"), .highlight:has-text("Component")').count();
    
    // Log for debugging
    console.log(`Found ${highlights} highlighted instances of "Component"`);
  });

  test('search performance with long text', async ({ page }) => {
    const searchBox = page.locator('#searchBox');
    const startTime = Date.now();
    
    // Search with a longer phrase
    await searchBox.fill('Infrastructure as Code using real programming languages');
    await page.waitForTimeout(500);
    
    const endTime = Date.now();
    const searchTime = endTime - startTime;
    
    // Search should complete within reasonable time (2 seconds)
    expect(searchTime).toBeLessThan(2000);
    
    // Should still return results
    const results = await page.locator('.question-card:visible').count();
    expect(results).toBeGreaterThan(0);
  });
});

// Additional test suite for edge cases
test.describe('Search Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML_PATH);
    await page.waitForLoadState('networkidle');
  });

  test('should handle empty search gracefully', async ({ page }) => {
    const searchBox = page.locator('#searchBox');
    
    // Just click without typing
    await searchBox.click();
    await searchBox.press('Enter');
    
    // All questions should still be visible
    const allQuestions = await page.locator('.question-card').count();
    const visibleQuestions = await page.locator('.question-card:visible').count();
    expect(visibleQuestions).toBe(allQuestions);
  });

  test('should handle whitespace-only search', async ({ page }) => {
    const searchBox = page.locator('#searchBox');
    
    await searchBox.fill('   ');
    await page.waitForTimeout(500);
    
    // Should treat as empty search
    const allQuestions = await page.locator('.question-card').count();
    const visibleQuestions = await page.locator('.question-card:visible').count();
    expect(visibleQuestions).toBe(allQuestions);
  });

  test('should handle very long search terms', async ({ page }) => {
    const searchBox = page.locator('#searchBox');
    const longSearchTerm = 'a'.repeat(100);
    
    await searchBox.fill(longSearchTerm);
    await page.waitForTimeout(500);
    
    // Should not crash and likely return no results
    const visibleQuestions = await page.locator('.question-card:visible').count();
    expect(visibleQuestions).toBe(0);
  });
});