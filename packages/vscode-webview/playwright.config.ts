import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for testing the VS Code webview
 */
export default defineConfig({
  testDir: './test',

  // Test execution settings
  timeout: 30 * 1000, // Maximum time one test can run
  expect: {
    timeout: 10000, // Maximum time expect() should wait
  },

  // Run tests in parallel
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['line'],
    ['json', { outputFile: 'test-results.json' }]
  ],

  // Shared settings for all projects
  use: {
    // Base URL for tests
    baseURL: process.env.WEBVIEW_URL || 'http://localhost:5173',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Timeout for actions
    actionTimeout: 10000,

    // Viewport size
    viewport: { width: 1280, height: 720 },
  },

  // Configure projects for major browsers
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
    {
      name: 'chrome',
      use: {
        channel: 'chrome',
        launchOptions: {
          args: ['--disable-web-security', '--disable-features=IsolateOrigins,site-per-process'],
        },
      },
    },
    // Mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Run local dev server before starting the tests
  webServer: [
    {
      command: 'npm run dev',
      port: 5173,
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    },
    // Uncomment if you want to start the OpenCode server automatically
    // {
    //   command: 'cd ../.. && bun dev',
    //   port: 8881,
    //   timeout: 120 * 1000,
    //   reuseExistingServer: !process.env.CI,
    // },
  ],
});