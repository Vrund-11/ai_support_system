import { test, expect } from '@playwright/test';

test.describe('Widget on Static Host Page & Live Chat AI Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Socket.IO handshake and Gateway polling if needed
    await page.route('**/socket.io/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sid: 'mock-socket-session-999',
          upgrades: [],
          pingInterval: 25000,
          pingTimeout: 20000,
        }),
      });
    });

    // Navigate to widget demo static host page
    await page.goto('/');
  });

  test('loads static host page with embedded SupportPilot script', async ({ page }) => {
    await expect(page).toHaveTitle(/SupportPilot Chat Widget Demo/i);
    await expect(page.locator('h1')).toContainText('SupportPilot Live Chat Widget');

    // Verify the chat bubble is rendered floating on host page
    const bubbleButton = page.locator('[data-testid="widget-bubble-button"]');
    await expect(bubbleButton).toBeVisible();
  });

  test('opens widget window when bubble button is clicked', async ({ page }) => {
    const bubbleButton = page.locator('[data-testid="widget-bubble-button"]');
    await bubbleButton.click();

    // Verify chat window opens
    const chatWindow = page.locator('[data-testid="widget-chat-window"]');
    await expect(chatWindow).toBeVisible();

    // Verify greeting and composer elements
    await expect(page.locator('[data-testid="widget-messages-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="widget-composer-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="widget-send-button"]')).toBeVisible();
  });

  test('allows typing a message and verifies optimistic send', async ({ page }) => {
    await page.locator('[data-testid="widget-bubble-button"]').click();

    const input = page.locator('[data-testid="widget-composer-input"]');
    const sendBtn = page.locator('[data-testid="widget-send-button"]');

    // Type query
    await input.fill('How do I reset my password?');
    await expect(sendBtn).toBeEnabled();

    // Submit message
    await sendBtn.click();

    // Verify composer input is cleared
    await expect(input).toHaveValue('');

    // Verify message appears in messages list
    const messageList = page.locator('[data-testid="widget-messages-list"]');
    await expect(messageList).toContainText('How do I reset my password?');
  });

  test('switches to offline leave-a-message form tab', async ({ page }) => {
    await page.locator('[data-testid="widget-bubble-button"]').click();

    // Click offline tab
    const offlineTab = page.locator('[data-testid="tab-offline"]');
    await offlineTab.click();

    // Verify offline form fields appear
    await expect(
      page.locator('input[name="customerName"], input[placeholder*="Name" i]'),
    ).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('textarea')).toBeVisible();
  });

  test('controls widget visibility via programmatic window.SupportPilot API', async ({ page }) => {
    // Click host button that calls window.SupportPilot.open()
    const hostOpenBtn = page.getByRole('button', { name: /Open Chat Widget via JS API/i });
    await hostOpenBtn.click();

    const chatWindow = page.locator('[data-testid="widget-chat-window"]');
    await expect(chatWindow).toBeVisible();

    // Click host button that calls window.SupportPilot.close()
    const hostCloseBtn = page.getByRole('button', { name: /Close Widget/i });
    await hostCloseBtn.click();

    await expect(chatWindow).not.toBeVisible();
  });
});
