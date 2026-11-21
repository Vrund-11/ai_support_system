import { test, expect } from '@playwright/test';
import { setupMockApi } from './mock-api';

const WEB_URL = process.env.PLAYWRIGHT_WEB_URL || 'http://localhost:5173';

test.describe('Agent Authentication & Session Lifecycle (AUTH)', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
    // Clear storage to ensure clean unauthenticated state
    await page.goto(WEB_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('TC-T1-AUTH-01: successful agent login navigates to dashboard with session', async ({
    page,
  }) => {
    // Assert Login view rendered
    await expect(page.getByRole('heading', { name: /Sign in to workspace/i })).toBeVisible();

    // Fill credentials
    const emailInput = page.locator('[data-testid="login-email-input"]');
    const passwordInput = page.locator('[data-testid="login-password-input"]');
    const submitBtn = page.locator('[data-testid="login-submit-button"]');

    await emailInput.fill('alex.vance@company.com');
    await passwordInput.fill('Secret123!');
    await submitBtn.click();

    // Verify navigation into authenticated Shell
    const inboxTab = page.locator('[data-testid="nav-inbox"]');
    await expect(inboxTab).toBeVisible();
    await expect(page.getByRole('heading', { name: /Inbox & Queue/i })).toBeVisible();

    // Verify agent profile display
    await expect(page.locator('text=Alex Vance').or(page.locator('text=AV'))).toBeVisible();
  });

  test('TC-T1-AUTH-04: agent logout terminates session and returns to login form', async ({
    page,
  }) => {
    // 1. Log in
    await page.locator('[data-testid="login-email-input"]').fill('alex.vance@company.com');
    await page.locator('[data-testid="login-password-input"]').fill('Secret123!');
    await page.locator('[data-testid="login-submit-button"]').click();

    // Verify in dashboard
    await expect(page.locator('[data-testid="nav-inbox"]')).toBeVisible();

    // 2. Click Sign Out button
    const logoutBtn = page.locator('button[title="Sign Out"]');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // Verify returned to Login Form
    await expect(page.getByRole('heading', { name: /Sign in to workspace/i })).toBeVisible();
    await expect(page.locator('[data-testid="login-email-input"]')).toBeVisible();
  });

  test('TC-T2-AUTH-02: invalid credentials display RFC 7807 problem details error banner', async ({
    page,
  }) => {
    await page.locator('[data-testid="login-email-input"]').fill('alex.vance@company.com');
    await page.locator('[data-testid="login-password-input"]').fill('WrongPassword!');
    await page.locator('[data-testid="login-submit-button"]').click();

    // Verify error banner
    const errorBanner = page.locator('[data-testid="login-error"]');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText(/Invalid email or password/i);
  });

  test('TC-T2-AUTH-03: rate limited login displays 429 problem details message', async ({
    page,
  }) => {
    await page.locator('[data-testid="login-email-input"]').fill('ratelimit@company.com');
    await page.locator('[data-testid="login-password-input"]').fill('AnyPassword123!');
    await page.locator('[data-testid="login-submit-button"]').click();

    // Verify rate limit banner
    const errorBanner = page.locator('[data-testid="login-error"]');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText(/Rate limit exceeded/i);
  });

  test('TC-T2-AUTH-04: toggles password field visibility masking', async ({ page }) => {
    const passwordInput = page.locator('[data-testid="login-password-input"]');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click toggle button
    const toggleBtn = page.locator('button[aria-label="Toggle password visibility"]');
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click again to mask
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
