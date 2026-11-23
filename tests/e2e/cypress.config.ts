import { defineConfig } from 'cypress';
import crypto from 'node:crypto';

export default defineConfig({
  viewportWidth: 1280,
  viewportHeight: 800,
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:5173',
    specPattern: 'tests/e2e/cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'tests/e2e/cypress/support/e2e.ts',
    videosFolder: 'tests/e2e/cypress/videos',
    screenshotsFolder: 'tests/e2e/cypress/screenshots',
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    viewportWidth: 1280,
    viewportHeight: 800,
    setupNodeEvents(on, config) {
      on('task', {
        signJwt(payload: { sub: string; tenantId: string; role: string }) {
          const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
            'base64url',
          );
          const now = Math.floor(Date.now() / 1000);
          const body = Buffer.from(
            JSON.stringify({
              ...payload,
              iat: now,
              exp: now + 3600,
            }),
          ).toString('base64url');
          const secret =
            process.env.JWT_ACCESS_SECRET || 'supportpilot-jwt-access-secret-32-chars!';
          const sig = crypto
            .createHmac('sha256', secret)
            .update(`${header}.${body}`)
            .digest('base64url');
          return `${header}.${body}.${sig}`;
        },
      });
      return config;
    },
  },
});
