import { test, expect } from '@playwright/test';

const WIDGET_URL = process.env.PLAYWRIGHT_WIDGET_URL || 'http://localhost:3001';
const DASHBOARD_URL = process.env.PLAYWRIGHT_LIVE_URL || 'http://localhost:3000';
const ACME_TENANT_ID = '507f1f77bcf86cd799439011';

test.describe('Live Stack E2E: Widget Offline Ticket Omnichannel Sync (03-widget-to-dashboard)', () => {
  test('customer submits offline widget ticket and agent views it in dashboard inbox', async ({
    context,
  }) => {
    const timestamp = Date.now();
    const uniqueSubject = `HEV suit battery depletion in sector C ${timestamp}`;
    const customerEmail = `gordon.${timestamp}@blackmesa.gov`;
    const customerName = 'Gordon Freeman';
    const messageBody = 'Urgent replacement battery pack required for Hazard Course.';

    // 1. Customer Context: Widget on port 3001
    const customerPage = await context.newPage();

    // Ensure widget embeds with Acme's tenant ID
    await customerPage.addInitScript((tenantId) => {
      const origGetAttribute = Element.prototype.getAttribute;
      Element.prototype.getAttribute = function (name: string) {
        if (name === 'data-tenant-id') {
          return tenantId;
        }
        return origGetAttribute.apply(this, arguments as any);
      };
    }, ACME_TENANT_ID);

    await customerPage.goto(WIDGET_URL);

    // Open chat bubble
    const bubbleBtn = customerPage.locator('[data-testid="widget-bubble-button"]');
    await expect(bubbleBtn).toBeVisible({ timeout: 15000 });
    await bubbleBtn.click();

    // Switch to offline form
    const offlineTab = customerPage.locator('[data-testid="tab-offline"]');
    await expect(offlineTab).toBeVisible();
    await offlineTab.click();

    // Fill form
    await customerPage.locator('[data-testid="offline-name-input"]').fill(customerName);
    await customerPage.locator('[data-testid="offline-email-input"]').fill(customerEmail);
    await customerPage.locator('[data-testid="offline-subject-input"]').fill(uniqueSubject);
    await customerPage.locator('[data-testid="offline-message-input"]').fill(messageBody);

    // Intercept public ticket submission API
    const publicSubmitPromise = customerPage.waitForResponse(
      (res) => res.url().includes('/api/v1/tickets/public') && res.request().method() === 'POST',
    );

    await customerPage.locator('[data-testid="offline-submit-button"]').click();

    const publicResponse = await publicSubmitPromise;
    expect(publicResponse.status()).toBe(201);

    // Verify confirmation view displayed to customer
    const successView = customerPage.locator('[data-testid="offline-success-view"]');
    await expect(successView).toBeVisible();
    await expect(successView).toContainText('Message Received!');

    // 2. Agent Context: Dashboard on port 3000
    const agentPage = await context.newPage();
    await agentPage.goto(DASHBOARD_URL);
    await agentPage.evaluate(() => localStorage.clear());
    await agentPage.reload();

    // Login as Acme agent
    await agentPage.locator('[data-testid="login-email-input"]').fill('admin@acme.com');
    await agentPage.locator('[data-testid="login-password-input"]').fill('Password123!');
    await agentPage.locator('[data-testid="login-submit-button"]').click();

    // Verify inbox table renders
    const ticketsTable = agentPage.locator('[data-testid="tickets-table"]');
    await expect(ticketsTable).toBeVisible({ timeout: 15000 });

    // Assert newly created customer ticket is present in queue
    const ticketLink = agentPage.locator(`text=${uniqueSubject}`).first();
    await expect(ticketLink).toBeVisible({ timeout: 10000 });

    // Click into ticket detail
    await ticketLink.click();
    await expect(agentPage.locator('[data-testid="ticket-detail-view"]')).toBeVisible({
      timeout: 10000,
    });
    await expect(agentPage.locator(`text=${customerEmail}`).first()).toBeVisible();

    await customerPage.close();
    await agentPage.close();
  });
});
