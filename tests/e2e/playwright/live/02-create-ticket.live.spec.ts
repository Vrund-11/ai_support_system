import { test, expect } from '@playwright/test';

const DASHBOARD_URL = process.env.PLAYWRIGHT_LIVE_URL || 'http://localhost:3000';

test.describe('Live Stack E2E: Agent Ticket Creation & Queue Verification (02-create-ticket)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Authenticate as Acme lead agent
    await page.locator('[data-testid="login-email-input"]').fill('admin@acme.com');
    await page.locator('[data-testid="login-password-input"]').fill('Password123!');
    await page.locator('[data-testid="login-submit-button"]').click();
    await expect(page.locator('[data-testid="nav-inbox"]')).toBeVisible({ timeout: 15000 });
  });

  test('creates a new ticket in modal and verifies persistence in queue and detail view', async ({
    page,
  }) => {
    const timestamp = Date.now();
    const uniqueSubject = `Live Stack E2E Ticket: Checkout Stripe Webhook Failure ${timestamp}`;
    const customerEmail = `sarah.connor.${timestamp}@cyberdyne.com`;

    // Click New Ticket button
    const newTicketBtn = page.locator('button:has-text("New Ticket")').first();
    await expect(newTicketBtn).toBeVisible();
    await newTicketBtn.click();

    // Verify modal appears
    const modal = page.locator('#create-ticket-modal');
    await expect(modal).toBeVisible();

    // Fill form
    await page.locator('#ticket-subject').fill(uniqueSubject);
    await page.locator('#customer-email').fill(customerEmail);
    await page.locator('#priority-select').selectOption('HIGH');
    await page
      .locator('#ticket-description')
      .fill('Payment gateway webhook 504 gateway timeout on subscription renewal.');

    // Add tag
    const tagInput = page.locator('#tag-input');
    await tagInput.fill('live-test');
    await tagInput.press('Enter');

    // Intercept ticket creation API request
    const createResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/v1/tickets') && res.request().method() === 'POST',
    );

    // Submit ticket
    const submitBtn = page.locator('button:has-text("Create Ticket")');
    await submitBtn.click();

    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);

    const body = await createResponse.json();
    const createdTicket = body.data || body;
    expect(createdTicket._id || createdTicket.id).toBeDefined();
    expect(createdTicket.number).toBeDefined();

    // Verify detail view opens
    const detailView = page.locator('[data-testid="ticket-detail-view"]');
    await expect(detailView).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h1')).toContainText(uniqueSubject);

    // Return to inbox queue
    const backBtn = page.locator('[data-testid="back-button"]');
    await backBtn.click();

    // Verify ticket appears in queue table
    const table = page.locator('[data-testid="tickets-table"]');
    await expect(table).toBeVisible();
    await expect(page.locator(`text=${uniqueSubject}`).first()).toBeVisible({ timeout: 10000 });
  });
});
