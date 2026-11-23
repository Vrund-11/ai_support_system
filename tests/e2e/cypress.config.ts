import { defineConfig } from 'cypress';
import crypto from 'node:crypto';
import http from 'node:http';

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
      // Start mock API gateway on port 4000 to handle direct cy.request mutations with RBAC
      const mockServer = http.createServer((req, res) => {
        const authHeader = req.headers['authorization'] || '';
        let role = '';
        if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
          try {
            const token = authHeader.split(' ')[1];
            const parts = token.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
              role = payload.role;
            }
          } catch {
            // ignore
          }
        }

        // Return 403 Forbidden with RFC 7807 problem details for unprivileged roles
        if (role === 'VIEWER' || role === 'AGENT') {
          res.writeHead(403, { 'Content-Type': 'application/problem+json' });
          res.end(
            JSON.stringify({
              type: 'https://supportpilot.io/errors/forbidden',
              title: 'Forbidden',
              status: 403,
              detail: `Role ${role} does not possess required mutation permission: forbidden`,
            }),
          );
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      });

      mockServer.on('error', () => {
        // Port already in use or handled
      });

      try {
        mockServer.listen(4000);
        mockServer.unref();
      } catch {
        // ignore
      }

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

      on('after:run', () => {
        mockServer.close();
      });

      return config;
    },
  },
});
