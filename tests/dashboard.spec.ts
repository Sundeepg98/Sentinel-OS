import { test, expect } from '@playwright/test';

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
    await expect(page.locator('header')).toBeVisible({ timeout: 15000 });
    
    // Wait for the RAG Engine to hydrate the UI
    // We look for the company selector to be populated
    const selector = page.locator('select');
    await expect(selector).toBeVisible();
  });

  test('should display the core 3D graph entry', async ({ page }) => {
    const graphButton = page.getByTitle('Open Knowledge Graph');
    await expect(graphButton).toBeVisible();
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
    const arenaBtn = page.getByRole('button', { name: /Arena/i });
    await arenaBtn.click();
    
    await expect(page.getByText(/The Architect's Arena/i)).toBeVisible();
  });
});
