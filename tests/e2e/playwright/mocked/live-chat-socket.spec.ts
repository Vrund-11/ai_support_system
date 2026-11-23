import { test, expect } from '@playwright/test';
import { setupMockApi, createInitialMockStore } from './mock-api';

const WIDGET_URL = process.env.PLAYWRIGHT_WIDGET_URL || 'http://localhost:5174';
const WEB_URL = process.env.PLAYWRIGHT_WEB_URL || 'http://localhost:5173';

test.describe('Realtime Live Chat & Agent Takeover (SOCKET / CHAT)', () => {
  test('agent reply appears live in widget and dashboard console', async ({ context }) => {
    const sharedStore = createInitialMockStore();

    // 1. Customer opens widget on 5174
    const customerPage = await context.newPage();
    await setupMockApi(customerPage, sharedStore);
    await customerPage.goto(WIDGET_URL);

    // Open chat bubble
    const bubbleBtn = customerPage.locator('[data-testid="widget-bubble-button"]');
    await expect(bubbleBtn).toBeVisible();
    await bubbleBtn.click();

    // Verify chat window opens
    const chatWindow = customerPage.locator('[data-testid="widget-chat-window"]');
    await expect(chatWindow).toBeVisible();

    // Customer types inquiry
    const customerInput = customerPage.locator('[data-testid="widget-composer-input"]');
    const customerSend = customerPage.locator('[data-testid="widget-send-button"]');
    await customerInput.fill(
      'Can I speak with a support agent regarding SAML certificate verification?',
    );
    await customerSend.click();

    // Verify message appears in customer chat window
    const messageList = customerPage.locator('[data-testid="widget-messages-list"]');
    await expect(messageList).toContainText('SAML certificate verification');

    // 2. Support Agent opens dashboard on 5173
    const agentPage = await context.newPage();
    await setupMockApi(agentPage, sharedStore);
    await agentPage.goto(WEB_URL);

    // Sign in
    await agentPage.locator('[data-testid="login-email-input"]').fill('alex.vance@company.com');
    await agentPage.locator('[data-testid="login-password-input"]').fill('Secret123!');
    await agentPage.locator('[data-testid="login-submit-button"]').click();

    // Navigate to Live Chats console
    const chatsTab = agentPage.locator('[data-testid="nav-chats"]');
    await expect(chatsTab).toBeVisible();
    await chatsTab.click();

    // Verify Live Agent Console view loaded
    await expect(agentPage.getByRole('heading', { name: /Live Agent Console/i })).toBeVisible();

    // Select waiting conversation: Take Over button must be present unconditionally
    const takeOverBtn = agentPage.getByRole('button', { name: /Take Over Chat/i });
    await expect(takeOverBtn).toBeVisible();
    await takeOverBtn.click();

    // Verify customer's first message is visible in agent console
    await expect(agentPage.locator('[data-testid="live-chat-messages-stream"]')).toContainText(
      'SAML certificate verification',
    );

    // Agent composes response
    const agentComposer = agentPage.locator('input[placeholder="Type reply to customer..."]');
    await expect(agentComposer).toBeVisible();
    await agentComposer.fill(
      'Hello! Alex Vance here. I would be happy to verify your SAML certificate.',
    );

    // Submit agent reply
    await agentComposer.press('Enter');

    // 1. Verify message appears in agent's own chat stream
    await expect(
      agentPage.locator('text=I would be happy to verify your SAML certificate'),
    ).toBeVisible();

    // 2. GENUINE CROSS-WINDOW VERIFICATION: Customer widget MUST receive agent reply
    await expect(customerPage.locator('[data-testid="widget-messages-list"]')).toContainText(
      'Hello! Alex Vance here',
    );

    // 3. Customer sends follow-up in widget
    await customerInput.fill('Thank you Alex, uploaded certificate PEM file.');
    await customerSend.click();
    await expect(messageList).toContainText('uploaded certificate PEM file');

    // 4. GENUINE CROSS-WINDOW VERIFICATION: Agent console MUST receive customer follow-up
    await expect(agentPage.locator('[data-testid="live-chat-messages-stream"]')).toContainText(
      'uploaded certificate PEM file',
    );

    await customerPage.close();
    await agentPage.close();
  });
});
