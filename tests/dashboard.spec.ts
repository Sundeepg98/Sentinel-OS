import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

/**
 * 🧪 STABILIZED E2E SUITE
 * Uses explicit locators and state-checks to handle the 
 * Glassmorphic UI and RAG hydration delays.
 */
test.describe('Sentinel-OS High-Stakes Simulator', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the local dev server
    await page.goto('/');
    
    // Wait for the main shell to mount
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 15000 });
    
    // Wait for the RAG Engine to hydrate the UI
    const selector = page.getByRole('combobox');
    await expect(selector).toBeVisible();
  });

  test('should display the core 3D graph entry', async ({ page }) => {
    const graphButton = page.getByTestId('graph-toggle');
    await expect(graphButton).toBeVisible();
  });

  test('should satisfy basic accessibility standards', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('#root > div > canvas') // Exclude 3D canvas from scan if it exists
      .analyze();

    // Core UI must be accessible
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should enter the War Room and start a simulation', async ({ page }) => {
    const warRoomBtn = page.getByRole('button', { name: /War Room/i });
    await warRoomBtn.click();
    
    // Verify view transition
    await expect(page.getByText(/Incident War Room/i)).toBeVisible();
    await expect(page.getByText(/Start Simulation/i)).toBeVisible();
  });

  test('should open global search', async ({ page }) => {
    // Standard keyboard shortcut verification
    await page.keyboard.press('Control+k');
    
    const searchInput = page.getByPlaceholder(/Search keywords/i);
    await expect(searchInput).toBeVisible();
  });

  test('should toggle the Architect Arena', async ({ page }) => {
    // Match the new 'Arena (X)' dynamic text
    const arenaBtn = page.getByTestId('arena-toggle');
    await arenaBtn.click();
    
    await expect(page.getByText(/The Architect's Arena/i)).toBeVisible();
  });
});
