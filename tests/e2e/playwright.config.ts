import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './playwright',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  reporter: [['list'], ['json', { outputFile: 'reports/playwright-results.json' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5174',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'pnpm --filter @supportpilot/web dev --port 5173',
      port: 5173,
      reuseExistingServer: true,
      timeout: 60000,
    },
    {
      command: 'pnpm --filter @supportpilot/widget dev --port 5174',
      port: 5174,
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
});
