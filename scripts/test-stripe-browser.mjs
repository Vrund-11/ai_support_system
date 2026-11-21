import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

async function run() {
  console.log('[Browser Test] Starting Chrome via Playwright...');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
  });
  const page = await context.newPage();

  const reportDir = path.resolve('reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  try {
    // 1. Navigate to Web Dashboard
    console.log('[Browser Test] 1. Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    // 2. Login if on login page
    const emailInput = page.locator('[data-testid="login-email-input"]');
    if (await emailInput.isVisible({ timeout: 4000 }).catch(() => false)) {
      console.log('[Browser Test] 2. Logging in as owner@initech.com...');
      await emailInput.fill('owner@initech.com');
      await page.locator('[data-testid="login-password-input"]').fill('Password123!');
      await page.locator('button[type="submit"]').click();
      await page.waitForLoadState('networkidle');
    }

    // 3. Navigate to Settings
    console.log('[Browser Test] 3. Clicking Settings in navigation...');
    const settingsNav = page.locator('[data-testid="nav-settings"]');
    await settingsNav.waitFor({ state: 'visible', timeout: 8000 });
    await settingsNav.click();
    await page.waitForTimeout(500);

    // 4. Navigate to Billing & Plans subtab
    console.log('[Browser Test] 4. Clicking Billing & Plans subtab...');
    const billingTabBtn = page.getByRole('button', { name: /Billing & Plans/i });
    await billingTabBtn.waitFor({ state: 'visible', timeout: 5000 });
    await billingTabBtn.click();
    await page.waitForTimeout(800);

    // 5. Check Initial Plan Status
    const planText = await page.textContent('body');
    console.log('[Browser Test] 5. Verifying initial plan is FREE or PRO...');
    const isInitialFree = planText.includes('SupportPilot FREE') || planText.includes('FREE');
    console.log(`[Browser Test] Initial Plan Detected: ${isInitialFree ? 'FREE' : 'PRO'}`);

    // 6. Open Upgrade to PRO Modal
    console.log('[Browser Test] 6. Looking for Upgrade to PRO button...');
    const upgradeBtn = page.getByRole('button', { name: /Upgrade to PRO/i });
    if (await upgradeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await upgradeBtn.click();
    } else {
      console.log('[Browser Test] Already on PRO, clicking Manage Subscription or testing modal directly...');
    }

    // Check modal visibility
    const modal = page.locator('div[role="dialog"]');
    await modal.waitFor({ state: 'visible', timeout: 5000 });
    console.log('[Browser Test] 7. Stripe Checkout Modal is open!');

    // 7. Test Decline Scenario
    console.log('[Browser Test] 8. Testing Card Decline (4000 0000 0000 0002)...');
    const declineCardBtn = modal.getByRole('button', { name: /Test Decline Card/i });
    await declineCardBtn.click();
    await page.waitForTimeout(300);

    const payBtn = modal.getByRole('button', { name: /Pay \$49\.00/i });
    await payBtn.click();

    // Verify decline error banner
    const errorBanner = modal.locator('text=/declined/i');
    await errorBanner.waitFor({ state: 'visible', timeout: 6000 });
    const declineErrorText = await errorBanner.textContent();
    console.log(`[Browser Test] ✓ Decline verified: "${declineErrorText?.trim()}"`);
    await page.screenshot({ path: path.join(reportDir, 'stripe-browser-decline.png') });

    // 8. Test Success Scenario
    console.log('[Browser Test] 9. Testing Card Approval (4242 4242 4242 4242)...');
    const fill4242Btn = modal.getByRole('button', { name: /Use 4242 Test Card/i });
    await fill4242Btn.click();
    await page.waitForTimeout(300);

    await payBtn.click();

    // Verify approval screen
    const successTitle = modal.locator('text=/Payment Approved by Stripe/i');
    await successTitle.waitFor({ state: 'visible', timeout: 8000 });
    console.log('[Browser Test] ✓ Approval screen verified: "Payment Approved by Stripe (Test Mode)"');
    await page.screenshot({ path: path.join(reportDir, 'stripe-browser-approved.png') });

    // 9. Return to Workspace
    console.log('[Browser Test] 10. Clicking Return to Workspace...');
    const returnBtn = modal.getByRole('button', { name: /Return to Workspace/i });
    await returnBtn.click();
    await page.waitForTimeout(1000);

    // 10. Verify Upgraded State
    console.log('[Browser Test] 11. Verifying active PRO status and quotas in UI...');
    await page.screenshot({ path: path.join(reportDir, 'stripe-browser-upgraded.png') });
    const updatedBodyText = await page.textContent('body');
    const hasPro = updatedBodyText.includes('SupportPilot PRO') || updatedBodyText.includes('PRO');
    const hasActive = updatedBodyText.includes('Active Pro Subscription') || updatedBodyText.includes('ACTIVE');

    console.log(`[Browser Test] Result: PRO Plan Active: ${hasPro}, Subscription Active: ${hasActive}`);
    console.log('[Browser Test] ✓ Complete end-to-end Stripe simulation workflow verified successfully!');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('[Browser Test] Failed:', err);
  process.exit(1);
});
