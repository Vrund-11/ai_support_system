import { test, expect } from '@playwright/test';
import { setupMockApi } from '../mock-api';

const WEB_URL = process.env.PLAYWRIGHT_WEB_URL || 'http://localhost:5173';

test.describe('Multi-Tenancy & Data Isolation Boundaries (TEN)', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
    await page.goto(WEB_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Authenticate as Tenant A agent
    await page.locator('[data-testid="login-email-input"]').fill('alex.vance@company.com');
    await page.locator('[data-testid="login-password-input"]').fill('Secret123!');
    await page.locator('[data-testid="login-submit-button"]').click();

    await expect(page.locator('[data-testid="nav-inbox"]')).toBeVisible();
  });

  test('TC-T1-TEN-02: tenant A cannot access tenant B ticket URL (expects 403/404)', async ({
    page,
    request,
  }) => {
    // 1. Direct API check: requesting Tenant B ticket returns 403 Forbidden
    const res = await page.evaluate(async () => {
      const response = await fetch('/api/v1/tickets/tkt_tenant_b_secret', {
        headers: { Authorization: 'Bearer mock-jwt-access-token-alex-vance' },
      });
      return {
        status: response.status,
        body: await response.json(),
      };
    });

    expect([403, 404]).toContain(res.status);
    expect(res.body.title).toMatch(/Forbidden|Not Found/i);

    // 2. Direct client fetch check via Playwright request context
    const apiRes = await request.get(`${WEB_URL}/api/v1/tickets/tkt_tenant_b_secret`);
    // Must be protected: returns 403 or 404 (200 strictly forbidden)
    expect([403, 404]).toContain(apiRes.status());

    // 3. Ensure Tenant A tickets table only displays Tenant A tickets
    const table = page.locator('[data-testid="tickets-table"]');
    await expect(table).toBeVisible();
    await expect(table).not.toContainText('Tenant B Confidential Data');
  });

  test('TC-T2-TEN-01: cross-tenant ticket mutation is rejected with 403 problem details', async ({
    page,
  }) => {
    // Attempt mutation against Tenant B ticket
    const mutationResult = await page.evaluate(async () => {
      const response = await fetch('/api/v1/tickets/tkt_tenant_b_secret', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-jwt-access-token-alex-vance',
        },
        body: JSON.stringify({ status: 'RESOLVED', version: 1 }),
      });
      return {
        status: response.status,
        problem: await response.json(),
      };
    });

    expect([403, 404]).toContain(mutationResult.status);
    expect(mutationResult.problem.detail).toMatch(/Cross-tenant access forbidden|not found/i);
  });
});
