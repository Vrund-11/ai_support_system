import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('SupportPilot Interactive Product Walkthrough & Video Recording', () => {
  test('executes multi-window customer & agent live chat interaction', async ({ browser }) => {
    // 1. Setup video recording context
    const videoDir = path.resolve(process.cwd(), 'reports/videos');
    const customerContext = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: {
        dir: videoDir,
        size: { width: 1280, height: 720 },
      },
    });

    const customerPage = await customerContext.newPage();

    // Mock Socket.IO handshakes & gateway responses for hermetic deterministic execution
    await customerPage.route('**/socket.io/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sid: 'demo-socket-visitor-101',
          upgrades: [],
          pingInterval: 25000,
          pingTimeout: 20000,
        }),
      });
    });

    // --- SCENE 1: Customer visits website & opens AI Chat Widget ---
    await customerPage.goto('/');
    await customerPage.waitForTimeout(1000);

    const bubbleButton = customerPage.locator('[data-testid="widget-bubble-button"]');
    await expect(bubbleButton).toBeVisible();
    await bubbleButton.click();
    await customerPage.waitForTimeout(1000);

    const chatWindow = customerPage.locator('[data-testid="widget-chat-window"]');
    await expect(chatWindow).toBeVisible();

    // --- SCENE 2: Customer asks AI a knowledge base question ---
    const composerInput = customerPage.locator('[data-testid="widget-composer-input"]');
    const sendButton = customerPage.locator('[data-testid="widget-send-button"]');

    await composerInput.fill('How do I configure business hours for SLA policies?');
    await customerPage.waitForTimeout(800);
    await sendButton.click();
    await customerPage.waitForTimeout(1500);

    // Verify message rendered in chat stream
    await expect(customerPage.locator('[data-testid="widget-messages-list"]')).toContainText(
      'How do I configure business hours',
    );

    // --- SCENE 3: Customer triggers human agent escalation ---
    await composerInput.fill(
      'My card was double-charged $99, I need an immediate refund from a human agent!',
    );
    await customerPage.waitForTimeout(800);
    await sendButton.click();
    await customerPage.waitForTimeout(1500);

    await expect(customerPage.locator('[data-testid="widget-messages-list"]')).toContainText(
      'double-charged $99',
    );

    // --- SCENE 4: Switch to Offline Form Tab to demonstrate after-hours ticketing ---
    const offlineTab = customerPage.locator('[data-testid="tab-offline"]');
    if (await offlineTab.isVisible()) {
      await offlineTab.click();
      await customerPage.waitForTimeout(1200);

      const nameInput = customerPage.locator(
        '[data-testid="offline-name-input"], input[name="customerName"]',
      );
      const emailInput = customerPage.locator(
        '[data-testid="offline-email-input"], input[name="customerEmail"]',
      );
      const textarea = customerPage.locator(
        '[data-testid="offline-message-input"], textarea[name="message"]',
      );

      if (await nameInput.isVisible()) {
        await nameInput.fill('Sarah Connor');
        await emailInput.fill('sarah@cyberdyne.io');
        await textarea.fill('Please follow up with my invoice receipt.');
        await customerPage.waitForTimeout(1000);
      }
    }

    // Capture screenshot of final state
    await customerPage.screenshot({
      path: path.join(videoDir, 'demo-widget-final.png'),
      fullPage: true,
    });

    await customerPage.waitForTimeout(1500);

    // Close page to flush recorded video to disk
    await customerPage.close();
    await customerContext.close();

    const video = await customerPage.video();
    if (video) {
      const videoPath = await video.path();
      console.log(`[VIDEO RECORDED] Video saved at: ${videoPath}`);
    }
  });
});
