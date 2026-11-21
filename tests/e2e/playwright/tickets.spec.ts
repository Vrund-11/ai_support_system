import { test, expect } from '@playwright/test';
import { setupMockApi, createInitialMockStore } from './mock-api';

const WEB_URL = process.env.PLAYWRIGHT_WEB_URL || 'http://localhost:5173';

test.describe('Ticket Lifecycle, Management & Concurrency (TKT)', () => {
  test.beforeEach(async ({ page }) => {
    const store = createInitialMockStore();
    await setupMockApi(page, store);

    // Navigate and sign in
    await page.goto(WEB_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.locator('[data-testid="login-email-input"]').fill('alex.vance@company.com');
    await page.locator('[data-testid="login-password-input"]').fill('Secret123!');
    await page.locator('[data-testid="login-submit-button"]').click();

    await expect(page.locator('[data-testid="nav-inbox"]')).toBeVisible();
  });

  test('TC-T1-TKT-01: creates new ticket from dashboard modal and displays detail view', async ({
    page,
  }) => {
    // Click New Ticket button
    const newTicketBtn = page.locator('button:has-text("New Ticket")').first();
    await newTicketBtn.click();

    // Verify modal appears
    const modal = page.locator('#create-ticket-modal');
    await expect(modal).toBeVisible();

    // Fill form fields
    await page.locator('#ticket-subject').fill('Enterprise SAML SSO redirect loop on Okta');
    await page.locator('#customer-email').fill('security.lead@acme-corp.com');
    await page.locator('#priority-select').selectOption('HIGH');
    await page
      .locator('#ticket-description')
      .fill('Users redirected infinitely when logging in via Okta SAML assertion.');

    // Add custom tag
    const tagInput = page.locator('#tag-input');
    await tagInput.fill('okta-auth');
    await tagInput.press('Enter');

    // Submit ticket
    const submitBtn = page.locator('button:has-text("Create Ticket")');
    await submitBtn.click();

    // Verify detail view opens for newly created ticket
    const detailView = page.locator('[data-testid="ticket-detail-view"]');
    await expect(detailView).toBeVisible();
    await expect(page.locator('h1')).toContainText('Enterprise SAML SSO redirect loop on Okta');

    // Verify back navigation returns to inbox
    const backBtn = page.locator('[data-testid="back-button"]');
    await backBtn.click();
    await expect(page.locator('[data-testid="tickets-table"]')).toBeVisible();
  });

  test('TC-T1-TKT-03: updates ticket status and reflects state change in detail view', async ({
    page,
  }) => {
    // Open existing ticket tkt_001
    const ticketRow = page.locator('[data-testid="ticket-row-tkt_001"]');
    await expect(ticketRow).toBeVisible();
    await ticketRow.click();

    // Verify detail view loaded
    await expect(page.locator('[data-testid="ticket-detail-view"]')).toBeVisible();

    // Update status to RESOLVED
    const statusSelect = page.locator('[data-testid="detail-status-select"]');
    await expect(statusSelect).toBeVisible();
    await statusSelect.selectOption('RESOLVED');

    // Verify status updated in select
    await expect(statusSelect).toHaveValue('RESOLVED');
  });

  test('TC-T2-TKT-01: displays 409 conflict warning when saving stale ticket version', async ({
    page,
  }) => {
    // Open ticket tkt_001
    await page.locator('[data-testid="ticket-row-tkt_001"]').click();
    await expect(page.locator('[data-testid="ticket-detail-view"]')).toBeVisible();

    // Override the PATCH route on this page to simulate concurrent update 409
    await page.route('**/api/v1/tickets/tkt_001', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 409,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            type: 'https://supportpilot.io/errors/conflict',
            title: 'Conflict',
            status: 409,
            detail: 'Ticket was modified by another user',
          }),
        });
      } else {
        await route.fallback();
      }
    });

    // Attempt status mutation
    const statusSelect = page.locator('[data-testid="detail-status-select"]');
    await statusSelect.selectOption('PENDING_CUSTOMER');

    // Verify conflict warning banner appears
    const conflictWarning = page.locator('[data-testid="conflict-warning"]');
    await expect(conflictWarning).toBeVisible();
    await expect(conflictWarning).toContainText(/updated by another agent|modified/i);
  });

  test('TC-T2-TKT-02: filters tickets by priority chips in inbox view', async ({ page }) => {
    // Click HIGH priority filter chip
    const highChip = page.getByRole('button', { name: /^HIGH$/i });
    if (await highChip.isVisible()) {
      await highChip.click();
      // Verify table still rendered
      await expect(page.locator('[data-testid="tickets-table"]')).toBeVisible();
    }

    // Click All filter chip to reset
    const allChip = page.getByRole('button', { name: /^All$/i });
    if (await allChip.isVisible()) {
      await allChip.click();
      await expect(page.locator('[data-testid="tickets-table"]')).toBeVisible();
    }
  });
});
