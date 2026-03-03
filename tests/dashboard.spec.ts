import { test, expect } from '@playwright/test';

test.describe('Mailin Engineering Sentinel Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the local dev server
    await page.goto('http://localhost:5173/');
  });

  test('should display the Command Center by default', async ({ page }) => {
    await expect(page.getByText('System Command Center')).toBeVisible();
    await expect(page.getByText('Throughput SLA')).toBeVisible();
  });

  test('should navigate between tabs', async ({ page }) => {
    // Click on V8 & Libuv tab
    await page.getByRole('button', { name: 'V8 & Libuv' }).click();
    await expect(page.getByText('V8 Engine & Libuv Deep Dive')).toBeVisible();

    // Click on System Design tab
    await page.getByRole('button', { name: 'System Design' }).click();
    await expect(page.getByText('Distributed Architecture Map')).toBeVisible();
  });

  test('should open search with keyboard shortcut', async ({ page }) => {
    // Trigger search with Meta+K (using Control for Windows/Linux)
    await page.keyboard.press('Control+k');
    await expect(page.getByPlaceholder('Search for internal mechanics, patterns, or playbooks...')).toBeVisible();
    
    // Type a query
    await page.fill('input[placeholder="Search for internal mechanics, patterns, or playbooks..."]', 'gRPC');
    
    // Should see results
    await expect(page.getByText('Binary gRPC Protocols')).toBeVisible();
    
    // Select the result
    await page.click('text=Binary gRPC Protocols');
    
    // Should navigate to System Design
    await expect(page.getByText('Distributed Architecture Map')).toBeVisible();
    // And search should be closed
    await expect(page.getByPlaceholder('Search for internal mechanics, patterns, or playbooks...')).not.toBeVisible();
  });
});
