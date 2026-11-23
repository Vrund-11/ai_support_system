import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const isLive =
  process.env.PLAYWRIGHT_LIVE === 'true' ||
  process.env.npm_lifecycle_event === 'test:playwright:live' ||
  process.argv.some((arg) => arg.includes('live'));

export default defineConfig({
  testDir: './playwright',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  workers: process.env.CI ? 2 : 4,
  fullyParallel: false,
  reporter: [
    ['list'],
    ['json', { outputFile: path.resolve(__dirname, '../../reports/playwright-results.json') }],
    ['json', { outputFile: path.resolve(__dirname, 'reports/playwright-results.json') }],
  ],
  use: {
    trace: 'on-first-retry',
  },
  webServer:
    isLive || process.env.SKIP_WEBSERVER === 'true'
      ? undefined
      : [
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
      name: 'mocked',
      testDir: './playwright/mocked',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5174',
      },
    },
    {
      name: 'live',
      testDir: './playwright/live',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.PLAYWRIGHT_LIVE_URL || 'http://localhost:3000',
      },
    },
  ],
});
