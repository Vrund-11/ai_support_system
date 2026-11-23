import { test, expect } from '@playwright/test';

const DASHBOARD_URL = process.env.PLAYWRIGHT_LIVE_URL || 'http://localhost:3000';

test.describe('Live Stack E2E: Authentication & Session Lifecycle (01-login)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('successful login with seeded admin credentials grants access to dashboard', async ({
    page,
  }) => {
    // Assert Login view rendered
    await expect(page.getByRole('heading', { name: /Sign in to workspace/i })).toBeVisible();

    const emailInput = page.locator('[data-testid="login-email-input"]');
    const passwordInput = page.locator('[data-testid="login-password-input"]');
    const submitBtn = page.locator('[data-testid="login-submit-button"]');

    await emailInput.fill('admin@acme.com');
    await passwordInput.fill('Password123!');

    // Intercept network response for real login API call
    const loginResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/v1/auth/login') && res.request().method() === 'POST',
    );

    await submitBtn.click();

    const loginResponse = await loginResponsePromise;
    expect(loginResponse.status()).toBe(200);

    const body = await loginResponse.json();
    const token =
      body.data?.tokens?.accessToken ||
      body.data?.accessToken ||
      body.tokens?.accessToken ||
      body.accessToken ||
      body.token;
    expect(token).toBeDefined();

    // Verify navigation into authenticated Shell
    const inboxTab = page.locator('[data-testid="nav-inbox"]');
    await expect(inboxTab).toBeVisible({ timeout: 15000 });

    // Verify user profile display (Bob Lead / LEAD role)
    await expect(page.getByText('Bob Lead').first()).toBeVisible();
  });

  test('invalid password displays RFC 7807 problem details error banner', async ({ page }) => {
    await page.locator('[data-testid="login-email-input"]').fill('admin@acme.com');
    await page.locator('[data-testid="login-password-input"]').fill('WrongPassword123!');

    const loginResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/v1/auth/login') && res.request().method() === 'POST',
    );

    await page.locator('[data-testid="login-submit-button"]').click();

    const loginResponse = await loginResponsePromise;
    expect([400, 401]).toContain(loginResponse.status());

    // Verify error banner rendered
    const errorBanner = page.locator('[data-testid="login-error"]');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText(/Invalid email or password/i);
  });
});
