import { test, expect } from '@playwright/test';

const DASHBOARD_URL = process.env.PLAYWRIGHT_LIVE_URL || 'http://localhost:3000';

test.describe('Live Stack E2E: Public Reply and Internal Note Submission (05-reply)', () => {
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

  test('submits public reply and internal note, asserting thread persistence after reload', async ({
    page,
  }) => {
    const timestamp = Date.now();
    const publicReplyText = `SupportPilot engineering response to customer query: ${timestamp}`;
    const internalNoteText = `Internal engineering note: Escalate to Level 3 on-call ${timestamp}`;

    // 1. Open an existing ticket from queue (or create one)
    const table = page.locator('[data-testid="tickets-table"]');
    await expect(table).toBeVisible();

    const firstTicketRow = page
      .locator('tbody tr.ticket-row, [data-testid^="ticket-row-"]')
      .first();
    const hasRow = await firstTicketRow.count();

    if (hasRow > 0) {
      await firstTicketRow.locator('td').nth(1).click();
    } else {
      // Create a ticket if none exists
      await page.locator('button:has-text("New Ticket")').first().click();
      await page.locator('#ticket-subject').fill(`Ticket for Reply Spec ${timestamp}`);
      await page.locator('#customer-email').fill(`customer.${timestamp}@example.com`);
      await page.locator('#ticket-description').fill('Customer inquiry needing agent response.');
      await page.locator('button:has-text("Create Ticket")').click();
    }

    const detailView = page.locator('[data-testid="ticket-detail-view"]');
    await expect(detailView).toBeVisible({ timeout: 10000 });

    // 2. Submit Public Reply
    const publicTab = page.locator('[data-testid="composer-public-tab"]');
    await expect(publicTab).toBeVisible();
    await publicTab.click();

    const textarea = page.locator('[data-testid="message-textarea"]');
    await textarea.fill(publicReplyText);

    const publicMsgPromise = page.waitForResponse(
      (res) => res.url().includes('/messages') && res.request().method() === 'POST',
    );

    const sendBtn = page.locator('[data-testid="send-message-button"]');
    await sendBtn.click();

    const publicMsgRes = await publicMsgPromise;
    expect([200, 201]).toContain(publicMsgRes.status());

    // Verify public reply renders in message thread
    const threadContainer = page.locator('[data-testid="message-thread-container"]');
    await expect(threadContainer).toBeVisible();
    await expect(page.locator(`text=${publicReplyText}`).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Support Agent').first()).toBeVisible();

    // 3. Submit Internal Note
    const internalTab = page.locator('[data-testid="composer-internal-tab"]');
    await expect(internalTab).toBeVisible();
    await internalTab.click();

    await textarea.fill(internalNoteText);

    const internalMsgPromise = page.waitForResponse(
      (res) => res.url().includes('/messages') && res.request().method() === 'POST',
    );

    await sendBtn.click();

    const internalMsgRes = await internalMsgPromise;
    expect([200, 201]).toContain(internalMsgRes.status());

    // Verify internal note renders in message thread
    await expect(page.locator(`text=${internalNoteText}`).first()).toBeVisible({ timeout: 10000 });

    // 4. Persistence verification: reload page and assert both messages load from MongoDB
    await page.reload();
    await expect(detailView).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${publicReplyText}`).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${internalNoteText}`).first()).toBeVisible({ timeout: 10000 });
  });
});
