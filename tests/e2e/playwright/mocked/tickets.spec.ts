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

  test('TC-T2-TKT-01: displays 409 conflict warning and reloads latest server data', async ({
    page,
  }) => {
    // Open ticket tkt_001
    await page.locator('[data-testid="ticket-row-tkt_001"]').click();
    await expect(page.locator('[data-testid="ticket-detail-view"]')).toBeVisible();

    let patchAttempted = false;

    // Override route: 409 on PATCH, then updated ticket (version 2) on subsequent GET refetch
    await page.route('**/api/v1/tickets/tkt_001', async (route) => {
      if (route.request().method() === 'PATCH') {
        patchAttempted = true;
        await route.fulfill({
          status: 409,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            type: '/errors/version-conflict',
            title: 'Conflict: ticket has been modified concurrently.',
            status: 409,
            detail: 'Ticket was modified by another user',
          }),
        });
      } else {
        // Return updated version 2 if PATCH already failed (simulating concurrent save by peer)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              ticket: {
                id: 'tkt_001',
                number: 1001,
                subject: 'Cannot login with SAML Okta integration',
                description: 'Customer reports 403 signature mismatch on SAML callback assertion.',
                priority: 'HIGH',
                status: 'OPEN',
                version: patchAttempted ? 2 : 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              timeline: [],
              messages: [],
            },
          }),
        });
      }
    });

    // Attempt status mutation
    const statusSelect = page.locator('[data-testid="detail-status-select"]');
    await statusSelect.selectOption('PENDING_CUSTOMER');

    // 1. Verify conflict warning banner appears
    const conflictWarning = page.locator('[data-testid="conflict-warning"]');
    await expect(conflictWarning).toBeVisible();
    await expect(conflictWarning).toContainText(/updated by another agent|modified/i);

    // 2. Verify reload verification: void refetch() reloads server version
    await expect(page.getByText('v2', { exact: true })).toBeVisible();

    // 3. Verify select element reloads to server's true current status (OPEN)
    await expect(statusSelect).toHaveValue('OPEN');
  });

  test('TC-T2-TKT-02: filters tickets by priority chips in inbox view', async ({ page }) => {
    const table = page.locator('[data-testid="tickets-table"]');
    await expect(table).toBeVisible();

    // Click HIGH priority filter chip unconditionally
    const highChip = page.getByRole('button', { name: /^HIGH$/i });
    await expect(highChip).toBeVisible();
    await highChip.click();

    // Verify table filtered to high priority ticket (#1001) and low priority (#1002) excluded
    await expect(page.locator('[data-testid="ticket-row-tkt_001"]')).toBeVisible();
    await expect(page.locator('[data-testid="ticket-row-tkt_002"]')).not.toBeVisible();
    await expect(table).toContainText('#1001');
    await expect(table).not.toContainText('#1002');

    // Click All filter chip unconditionally to reset filter
    const allChip = page.getByRole('button', { name: /^All$/i });
    await expect(allChip).toBeVisible();
    await allChip.click();

    // Verify both tickets visible again
    await expect(page.locator('[data-testid="ticket-row-tkt_001"]')).toBeVisible();
    await expect(page.locator('[data-testid="ticket-row-tkt_002"]')).toBeVisible();
    await expect(table).toContainText('#1001');
    await expect(table).toContainText('#1002');
  });

  test('TC-T3-VIRT-01: virtualizes large inbox table rendering under 100 row nodes with 5,000 items', async ({
    page,
  }) => {
    const largeTicketSet = Array.from({ length: 5000 }, (_, i) => ({
      id: `tkt_large_${i + 1}`,
      number: i + 1,
      tenantId: '507f1f77bcf86cd799439011',
      subject: `Virtualization Test Ticket #${i + 1}`,
      description: 'Stress testing virtual row count',
      status: 'OPEN',
      priority: 'MEDIUM',
      customerId: 'cust_perf',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    await page.route('**/api/v1/tickets*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: largeTicketSet,
          items: largeTicketSet,
          meta: { cursor: 'next_cursor_123', hasMore: true },
        }),
      });
    });

    await page.locator('[data-testid="nav-inbox"]').click();
    const table = page.locator('[data-testid="tickets-table"]');
    await expect(table).toBeVisible();

    const renderedRowCount = await page.locator('tbody#ticketTableBody tr.ticket-row').count();
    expect(renderedRowCount).toBeLessThan(100);
    expect(renderedRowCount).toBeGreaterThan(0);
  });
});
