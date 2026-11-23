import { test, expect } from '@playwright/test';

const DASHBOARD_URL = process.env.PLAYWRIGHT_LIVE_URL || 'http://localhost:3000';

test.describe('Live Stack E2E: Knowledge Base Document Ingestion & RAG Retrieval (06-kb-upload)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DASHBOARD_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Authenticate as LEAD agent (OWNER or LEAD role required for KB uploads)
    await page.locator('[data-testid="login-email-input"]').fill('admin@acme.com');
    await page.locator('[data-testid="login-password-input"]').fill('Password123!');
    await page.locator('[data-testid="login-submit-button"]').click();
    await expect(page.locator('[data-testid="nav-inbox"]')).toBeVisible({ timeout: 15000 });
  });

  test('LEAD agent uploads document via POST /api/v1/kb/documents and tests retrieval synthesis', async ({
    page,
  }) => {
    const timestamp = Date.now();
    const docTitle = `Enterprise SSO & Data Policy Standard ${timestamp}`;
    const docContent = `# Enterprise SSO Standard\n\nSupportPilot mandates SAML 2.0 and AES-256 encryption at rest.\nAll sessions expire after 24 hours of inactivity.`;

    // 1. Navigate to Knowledge Base tab
    const kbTab = page.locator('[data-testid="nav-kb"]');
    await expect(kbTab).toBeVisible();
    await kbTab.click();

    await expect(page.getByRole('heading', { name: /Knowledge Base & Vector Store/i })).toBeVisible(
      { timeout: 10000 },
    );

    // 2. Open Add Document modal
    const addDocBtn = page.getByRole('button', { name: /Add Document/i });
    await expect(addDocBtn).toBeVisible();
    await addDocBtn.click();

    // 3. Fill modal
    const titleInput = page.locator(
      'input[placeholder*="Account Security and SAML Configuration"]',
    );
    await expect(titleInput).toBeVisible();
    await titleInput.fill(docTitle);

    const contentTextarea = page.locator('textarea[placeholder*="Paste markdown content here"]');
    await contentTextarea.fill(docContent);

    // 4. Intercept KB document ingestion API call
    const uploadResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/v1/kb/documents') && res.request().method() === 'POST',
    );

    const ingestBtn = page.getByRole('button', { name: /Ingest Document/i });
    await ingestBtn.click();

    const uploadResponse = await uploadResponsePromise;
    expect([200, 201, 202]).toContain(uploadResponse.status());

    // 5. Verify new document appears in documents table with status chip
    await expect(page.locator(`text=${docTitle}`).first()).toBeVisible({ timeout: 10000 });

    // 6. Switch to Test Console tab
    const testConsoleBtn = page.getByRole('button', { name: /Test Console/i });
    await expect(testConsoleBtn).toBeVisible();
    await testConsoleBtn.click();

    const queryInput = page.locator(
      'textarea[placeholder*="How do I configure SAML SSO in SupportPilot?"]',
    );
    await expect(queryInput).toBeVisible();
    await queryInput.fill('How does SupportPilot handle SSO and encryption?');

    // 7. Run retrieval and assert synthesis output
    const runBtn = page.getByRole('button', { name: /Run Retrieval & Synthesis/i });
    await expect(runBtn).toBeVisible();

    const answerResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/v1/ai/answer') && res.request().method() === 'POST',
      { timeout: 30000 },
    );

    await runBtn.click();

    const answerResponse = await answerResponsePromise;
    expect([200, 201]).toContain(answerResponse.status());

    // Assert synthesis & verification output rendered
    await expect(page.locator('text=Calibrated Confidence')).toBeVisible({ timeout: 15000 });
  });
});
