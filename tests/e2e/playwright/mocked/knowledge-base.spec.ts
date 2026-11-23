import { test, expect } from '@playwright/test';
import { setupMockApi, createInitialMockStore } from '../mock-api';

const WEB_URL = process.env.PLAYWRIGHT_WEB_URL || 'http://localhost:5173';

test.describe('Knowledge Base Management, Ingestion & Grounding (KB / AI)', () => {
  test.beforeEach(async ({ page }) => {
    const store = createInitialMockStore();
    await setupMockApi(page, store);

    await page.goto(WEB_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Login as agent
    await page.locator('[data-testid="login-email-input"]').fill('alex.vance@company.com');
    await page.locator('[data-testid="login-password-input"]').fill('Secret123!');
    await page.locator('[data-testid="login-submit-button"]').click();

    // Navigate to Knowledge Base tab
    const kbTab = page.locator('[data-testid="nav-kb"]');
    await expect(kbTab).toBeVisible();
    await kbTab.click();

    await expect(
      page.getByRole('heading', { name: /Knowledge Base & Vector Store/i }),
    ).toBeVisible();
  });

  test('TC-T1-KB-02: KB upload shows status change from PROCESSING to READY', async ({ page }) => {
    // 1. Click Add Document button
    const addDocBtn = page.getByRole('button', { name: /Add Document/i });
    await expect(addDocBtn).toBeVisible();
    await addDocBtn.click();

    // 2. Fill modal form
    const titleInput = page.locator(
      'input[placeholder*="Account Security and SAML Configuration"]',
    );
    await expect(titleInput).toBeVisible();
    await titleInput.fill('SOC-2 Compliance and Data Encryption Standards');

    const contentTextarea = page.locator('textarea[placeholder*="Paste markdown content here"]');
    await contentTextarea.fill(
      '# Encryption Standards\nAll customer data encrypted at rest using AES-256 and in transit via TLS 1.3.',
    );

    // 3. Submit document for ingestion
    const ingestBtn = page.getByRole('button', { name: /Ingest Document/i });
    await ingestBtn.click();

    // 4. Assert document row appears with PROCESSING or READY status
    const docRow = page.locator('text=SOC-2 Compliance and Data Encryption Standards');
    await expect(docRow).toBeVisible();

    // 5. Verify status change: either shows PROCESSING then transitions to READY, or shows READY
    const statusChip = page.locator('tr:has-text("SOC-2 Compliance")');
    await expect(statusChip).toContainText(/PROCESSING|READY/i);

    // Wait for ingestion completion (mock transitions to READY)
    await expect(statusChip).toContainText(/READY/i, { timeout: 10000 });
  });

  test('TC-T1-KB-05: Test Retrieval Console returns grounded RAG answer and citations', async ({
    page,
  }) => {
    // Switch to Test Console tab
    const testConsoleBtn = page.getByRole('button', { name: /Test Console/i });
    await expect(testConsoleBtn).toBeVisible();
    await testConsoleBtn.click();

    // Query textarea
    const queryInput = page.locator(
      'textarea[placeholder*="How do I configure SAML SSO in SupportPilot?"]',
    );
    await expect(queryInput).toBeVisible();
    await queryInput.fill('How does SupportPilot encrypt customer data?');

    // Run retrieval
    const runBtn = page.getByRole('button', { name: /Run Retrieval & Synthesis/i });
    await runBtn.click();

    // Verify synthesized response and citations
    await expect(page.locator('text=Synthesized RAG Response')).toBeVisible();
    await expect(page.locator('text=Calibrated Confidence')).toBeVisible();
    await expect(page.locator('text=AES-256')).toBeVisible();
  });
});
