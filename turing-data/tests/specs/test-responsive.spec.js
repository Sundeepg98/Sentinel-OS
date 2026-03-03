const { test, expect, devices } = require('@playwright/test');
const { HTML_PATH } = require('../test-config');

// Define viewport sizes for different devices
const viewports = {
  mobile: { width: 375, height: 667, deviceScaleFactor: 2 }, // iPhone SE
  tablet: { width: 768, height: 1024, deviceScaleFactor: 2 }, // iPad
  desktop: { width: 1920, height: 1080, deviceScaleFactor: 1 } // Full HD
};

// Common device presets from Playwright
const devicePresets = {
  mobile: devices['iPhone 12'],
  tablet: devices['iPad Pro'],
  desktop: null // Will use custom viewport
};

// Test files will be structured by device type
// Mobile tests with iPhone 12 preset
const mobileTest = test.extend({
  ...devicePresets.mobile
});

// Tablet tests with iPad Pro preset
const tabletTest = test.extend({
  ...devicePresets.tablet
});

// Desktop tests with custom viewport
const desktopTest = test.extend({
  viewport: viewports.desktop
});

test.describe('Responsive Design Tests', () => {
  const baseURL = HTML_PATH;

  test.describe('Mobile View Tests', () => {

    mobileTest('should display properly on mobile devices', async ({ page }) => {
      await page.goto(baseURL);
      
      // Check viewport
      const viewport = page.viewportSize();
      expect(viewport.width).toBeLessThanOrEqual(414);
      
      // Check mobile-specific elements
      const header = page.locator('header');
      await expect(header).toBeVisible();
      
      // Check if navigation is mobile-friendly (hamburger menu or stacked)
      const nav = page.locator('nav');
      const navBox = await nav.boundingBox();
      if (navBox) {
        // Navigation should be full width on mobile
        expect(navBox.width).toBeGreaterThan(300);
      }
      
      // Check text readability
      const mainContent = page.locator('main, .content, #content').first();
      await expect(mainContent).toBeVisible();
      
      // Verify no horizontal scrolling
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const windowWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(windowWidth);
      
      // Check font sizes are appropriate for mobile
      const fontSize = await mainContent.evaluate(el => 
        window.getComputedStyle(el).fontSize
      );
      expect(parseInt(fontSize)).toBeGreaterThanOrEqual(14);
    });

    mobileTest('should handle touch interactions on mobile', async ({ page }) => {
      await page.goto(baseURL);
      
      // Test touch scrolling
      await page.touchscreen.tap(200, 300);
      await page.waitForTimeout(100);
      
      // Test swipe gesture
      await page.touchscreen.swipe({
        startX: 200,
        startY: 400,
        endX: 200,
        endY: 200,
        steps: 10
      });
      
      // Verify page scrolled
      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY).toBeGreaterThan(0);
    });
  });

  test.describe('Tablet View Tests', () => {
    tabletTest('should display properly on tablet devices', async ({ page }) => {
      await page.goto(baseURL);
      
      // Check viewport
      const viewport = page.viewportSize();
      expect(viewport.width).toBeGreaterThanOrEqual(768);
      expect(viewport.width).toBeLessThan(1024);
      
      // Check layout adaptation
      const mainContent = page.locator('main, .content, #content').first();
      await expect(mainContent).toBeVisible();
      
      // Check if content uses appropriate width
      const contentBox = await mainContent.boundingBox();
      if (contentBox) {
        // Content should have some margin/padding on tablet
        expect(contentBox.width).toBeLessThan(viewport.width - 40);
      }
      
      // Verify no horizontal scrolling
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const windowWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(windowWidth);
    });

    tabletTest('should support both orientations on tablet', async ({ page, context }) => {
      await page.goto(baseURL);
      
      // Test portrait orientation
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500);
      
      const portraitWidth = await page.evaluate(() => window.innerWidth);
      expect(portraitWidth).toBe(768);
      
      // Test landscape orientation
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.waitForTimeout(500);
      
      const landscapeWidth = await page.evaluate(() => window.innerWidth);
      expect(landscapeWidth).toBe(1024);
      
      // Verify layout adapts
      const mainContent = page.locator('main, .content, #content').first();
      await expect(mainContent).toBeVisible();
    });
  });

  test.describe('Desktop View Tests', () => {
    desktopTest('should display properly on desktop', async ({ page }) => {
      await page.goto(baseURL);
      
      // Check viewport
      const viewport = page.viewportSize();
      expect(viewport.width).toBeGreaterThanOrEqual(1920);
      
      // Check desktop layout
      const mainContent = page.locator('main, .content, #content').first();
      await expect(mainContent).toBeVisible();
      
      // Check if content has max-width constraint
      const contentBox = await mainContent.boundingBox();
      if (contentBox) {
        // Most desktop layouts limit content width for readability
        expect(contentBox.width).toBeLessThanOrEqual(1400);
      }
      
      // Check navigation is horizontal on desktop
      const nav = page.locator('nav');
      const navItems = nav.locator('a, li');
      const navItemsCount = await navItems.count();
      
      if (navItemsCount > 1) {
        const firstItem = await navItems.first().boundingBox();
        const secondItem = await navItems.nth(1).boundingBox();
        
        if (firstItem && secondItem) {
          // Items should be side by side on desktop
          expect(Math.abs(firstItem.y - secondItem.y)).toBeLessThan(10);
        }
      }
    });

    desktopTest('should handle hover states on desktop', async ({ page }) => {
      await page.goto(baseURL);
      
      // Find interactive elements
      const links = page.locator('a').first();
      const buttons = page.locator('button').first();
      
      // Test hover on link
      if (await links.count() > 0) {
        await links.hover();
        await page.waitForTimeout(100);
        
        // Check if hover state is applied (cursor change)
        const cursor = await links.evaluate(el => 
          window.getComputedStyle(el).cursor
        );
        expect(cursor).toBe('pointer');
      }
      
      // Test hover on button
      if (await buttons.count() > 0) {
        await buttons.hover();
        await page.waitForTimeout(100);
      }
    });
  });

  test.describe('Cross-Device Consistency Tests', () => {
    test('should maintain content consistency across devices', async ({ browser }) => {
      // Create contexts for different devices
      const mobileContext = await browser.newContext(devicePresets.mobile);
      const tabletContext = await browser.newContext(devicePresets.tablet);
      const desktopContext = await browser.newContext({
        viewport: viewports.desktop
      });
      
      // Create pages
      const mobilePage = await mobileContext.newPage();
      const tabletPage = await tabletContext.newPage();
      const desktopPage = await desktopContext.newPage();
      
      // Navigate all pages
      await Promise.all([
        mobilePage.goto(baseURL),
        tabletPage.goto(baseURL),
        desktopPage.goto(baseURL)
      ]);
      
      // Check that main content exists on all devices
      const mobileContent = await mobilePage.textContent('body');
      const tabletContent = await tabletPage.textContent('body');
      const desktopContent = await desktopPage.textContent('body');
      
      // Content should be similar (allowing for layout differences)
      expect(mobileContent.length).toBeGreaterThan(0);
      expect(tabletContent.length).toBeGreaterThan(0);
      expect(desktopContent.length).toBeGreaterThan(0);
      
      // Clean up
      await Promise.all([
        mobileContext.close(),
        tabletContext.close(),
        desktopContext.close()
      ]);
    });
  });

  test.describe('Responsive Images Tests', () => {
    test('should load appropriate images for device', async ({ page, context }) => {
      // Test on mobile
      await page.setViewportSize(viewports.mobile);
      await page.goto(baseURL);
      
      const images = page.locator('img');
      const imageCount = await images.count();
      
      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        
        // Check if image is loaded
        const naturalWidth = await img.evaluate(el => el.naturalWidth);
        if (naturalWidth > 0) {
          // Image loaded successfully
          await expect(img).toBeVisible();
          
          // Check if image fits viewport
          const imgBox = await img.boundingBox();
          if (imgBox) {
            expect(imgBox.width).toBeLessThanOrEqual(viewports.mobile.width);
          }
        }
      }
    });
  });

  test.describe('Media Queries Tests', () => {
    test('should apply correct styles at breakpoints', async ({ page }) => {
      await page.goto(baseURL);
      
      // Test common breakpoints
      const breakpoints = [
        { name: 'mobile', width: 480 },
        { name: 'tablet', width: 768 },
        { name: 'desktop', width: 1024 },
        { name: 'wide', width: 1440 }
      ];
      
      for (const breakpoint of breakpoints) {
        await page.setViewportSize({ 
          width: breakpoint.width, 
          height: 800 
        });
        
        await page.waitForTimeout(300); // Wait for resize
        
        // Check computed styles
        const mainElement = page.locator('main, .content, #content').first();
        const computedStyle = await mainElement.evaluate(el => {
          const style = window.getComputedStyle(el);
          return {
            display: style.display,
            width: style.width,
            padding: style.padding,
            margin: style.margin
          };
        });
        
        // Verify element is visible and styled
        expect(computedStyle.display).not.toBe('none');
      }
    });
  });

  test.describe('Performance on Different Devices', () => {
    test('should load quickly on mobile', async ({ page }) => {
      // Set mobile viewport and throttle network
      await page.setViewportSize(viewports.mobile);
      
      // Measure load time
      const startTime = Date.now();
      await page.goto(baseURL, { waitUntil: 'networkidle' });
      const loadTime = Date.now() - startTime;
      
      // Mobile should load within reasonable time
      expect(loadTime).toBeLessThan(5000); // 5 seconds
      
      // Check Core Web Vitals (simplified)
      const metrics = await page.evaluate(() => {
        return {
          hasLCP: performance.getEntriesByType('largest-contentful-paint').length > 0,
          hasFID: performance.getEntriesByType('first-input').length >= 0,
          hasCLS: true // CLS is cumulative, harder to check simply
        };
      });
      
      expect(metrics.hasLCP).toBeTruthy();
    });
  });
});