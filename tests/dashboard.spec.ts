import { test, expect } from '@playwright/test';

test.describe('Sentinel-OS High-Stakes Simulator', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the local dev server
    await page.goto('http://localhost:5173/');
    // Wait for the harvesting to complete
    await page.waitForSelector('text=MAILIN Profile');
  });

  test('should display the core 3D graph entry', async ({ page }) => {
    await expect(page.getByTitle('Open Knowledge Graph')).toBeVisible();
  });

  test('should enter the War Room and start a simulation', async ({ page }) => {
    await page.getByRole('button', { name: 'War Room' }).click();
    await expect(page.getByText('Incident War Room')).toBeVisible();
    await expect(page.getByText('Start Simulation')).toBeVisible();
  });

  test('should open global search', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.getByPlaceholder("Search keywords (e.g., 'Redis', 'V8')...")).toBeVisible();
  });

  test('should toggle the Architect Arena', async ({ page }) => {
    await page.getByRole('button', { name: 'Arena (0)' }).click();
    await expect(page.getByText("The Architect's Arena")).toBeVisible();
  });
});
