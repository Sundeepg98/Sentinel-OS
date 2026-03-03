// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  // Test directory
  testDir: './tests',
  
  // Test match pattern - look for test files
  testMatch: /.*\.(test|spec)\.(js|ts|jsx|tsx)$/,
  
  // Maximum time one test can run for
  timeout: 30 * 1000,
  
  // Maximum time to wait for each assertion
  expect: {
    timeout: 5000
  },
  
  // Run tests in files in parallel - OPTIMIZED FOR CLAUDE CODE
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry failed tests - reduced for faster feedback
  retries: process.env.CI ? 1 : 0,
  
  // Number of workers - match Claude's 10 parallel agents
  workers: process.env.CI ? 4 : 10,
  
  // Reporter configuration for HTML and JSON output
  reporter: [
    ['html', { outputFolder: 'test-output/html', open: 'never' }],
    ['json', { outputFile: 'test-output/results.json' }],
    ['list']
  ],
  
  // Shared settings for all projects
  use: {
    // Base URL for the static HTML site (root-level index.html)
    baseURL: `file://${process.cwd()}/index.html`,
    
    // Collect trace only on failure to save tokens
    trace: 'retain-on-failure',
    
    // Screenshot only on failure to manage token budget
    screenshot: {
      mode: 'only-on-failure',
      fullPage: true
    },
    
    // Video on failure
    video: 'retain-on-failure',
    
    // Viewport size
    viewport: { width: 1280, height: 720 },
    
    // Ignore HTTPS errors (useful for local testing)
    ignoreHTTPSErrors: true,
    
    // Locale
    locale: 'en-US',
    
    // Timezone
    timezoneId: 'America/New_York',
  },
  
  // Configure projects for Chrome, Firefox, and Safari browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Additional mobile testing configurations
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  
  // Output folder for test artifacts
  outputDir: 'test-output/artifacts',
  
  // Global setup and teardown (if needed)
  // globalSetup: require.resolve('./global-setup'),
  // globalTeardown: require.resolve('./global-teardown'),
  
  // Web server disabled - using file:// URLs directly for faster testing
  // webServer: {
  //   command: 'npx http-server . -p 8080 --silent',
  //   port: 8080,
  //   timeout: 120 * 1000,
  //   reuseExistingServer: !process.env.CI,
  // },
});