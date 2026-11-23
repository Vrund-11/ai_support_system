import { test, expect } from '@playwright/test';
import { setupMockApi, createInitialMockStore } from './mock-api';

const WIDGET_URL = process.env.PLAYWRIGHT_WIDGET_URL || 'http://localhost:5174';
const WEB_URL = process.env.PLAYWRIGHT_WEB_URL || 'http://localhost:5173';

test.describe('Widget to Dashboard Omnichannel Synchronization (TC-T3-10 / TC-T4-E2E-01)', () => {
  test('customer submits offline widget ticket and agent dashboard inbox sees it', async ({
    context,
  }) => {
    // Shared mock store so both widget and dashboard pages share state
    const sharedStore = createInitialMockStore();

    // 1. Customer visits widget host page on 5174
    const customerPage = await context.newPage();
    await setupMockApi(customerPage, sharedStore);
    await customerPage.goto(WIDGET_URL);

    // Open chat bubble
    const bubbleBtn = customerPage.locator('[data-testid="widget-bubble-button"]');
    await expect(bubbleBtn).toBeVisible();
    await bubbleBtn.click();

    // Switch to offline form
    const offlineTab = customerPage.locator('[data-testid="tab-offline"]');
    await expect(offlineTab).toBeVisible();
    await offlineTab.click();

    // Fill offline form
    await customerPage.locator('[data-testid="offline-name-input"]').fill('Gordon Freeman');
    await customerPage.locator('[data-testid="offline-email-input"]').fill('gordon@blackmesa.gov');
    await customerPage
      .locator('[data-testid="offline-subject-input"]')
      .fill('HEV suit battery depletion in sector C');
    await customerPage
      .locator('[data-testid="offline-message-input"]')
      .fill('Need urgent technical replacement battery pack for Hazard Course.');

    // Submit offline ticket
    const submitBtn = customerPage.locator('[data-testid="offline-submit-button"]');
    await submitBtn.click();

    // Verify confirmation view displayed to customer
    const successView = customerPage.locator('[data-testid="offline-success-view"]');
    await expect(successView).toBeVisible();
    await expect(successView).toContainText('Message Received!');

    // 2. Support Agent logs into dashboard on 5173
    const agentPage = await context.newPage();
    await setupMockApi(agentPage, sharedStore);
    await agentPage.goto(WEB_URL);

    // Login as agent
    await agentPage.locator('[data-testid="login-email-input"]').fill('alex.vance@company.com');
    await agentPage.locator('[data-testid="login-password-input"]').fill('Secret123!');
    await agentPage.locator('[data-testid="login-submit-button"]').click();

    // Verify inbox table renders
    const ticketsTable = agentPage.locator('[data-testid="tickets-table"]');
    await expect(ticketsTable).toBeVisible();

    // Verify newly submitted offline ticket appears in agent queue
    await expect(agentPage.locator('text=HEV suit battery depletion in sector C')).toBeVisible();

    // 3. Agent clicks into ticket to view details
    await agentPage.locator('text=HEV suit battery depletion in sector C').click();
    await expect(agentPage.locator('[data-testid="ticket-detail-view"]')).toBeVisible();
    await expect(agentPage.locator('text=gordon@blackmesa.gov')).toBeVisible();

    await customerPage.close();
    await agentPage.close();
  });
});
