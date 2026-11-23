import { test, expect } from '@playwright/test';

const DASHBOARD_URL = process.env.PLAYWRIGHT_LIVE_URL || 'http://localhost:3000';
const GATEWAY_URL = process.env.PLAYWRIGHT_GATEWAY_URL || 'http://localhost:4000';

test.describe('Live Stack E2E: Tenant Isolation Verification (04-tenant-isolation)', () => {
  test('strictly prevents cross-tenant ticket query and mutation across API and UI boundaries', async ({
    request,
    page,
  }) => {
    // 1. Authenticate as Globex tenant user to obtain a valid Globex ticket ID
    const globexLoginRes = await request.post(`${GATEWAY_URL}/api/v1/auth/login`, {
      data: {
        email: 'owner@globex.com',
        password: 'Password123!',
      },
    });
    expect(globexLoginRes.status()).toBe(200);
    const globexLoginData = await globexLoginRes.json();
    const globexToken =
      globexLoginData.data?.tokens?.accessToken ||
      globexLoginData.data?.accessToken ||
      globexLoginData.tokens?.accessToken ||
      globexLoginData.accessToken ||
      globexLoginData.token;

    // List Globex tickets (or create one if none exist)
    const globexListRes = await request.get(`${GATEWAY_URL}/api/v1/tickets`, {
      headers: { Authorization: `Bearer ${globexToken}` },
    });
    expect(globexListRes.status()).toBe(200);
    const globexListData = await globexListRes.json();
    const globexTickets = globexListData.data || globexListData.items || globexListData;

    let globexTicketId: string;
    let globexTicketSubject: string;

    if (Array.isArray(globexTickets) && globexTickets.length > 0) {
      globexTicketId = globexTickets[0]._id || globexTickets[0].id;
      globexTicketSubject = globexTickets[0].subject;
    } else {
      // Create a Globex ticket
      const createRes = await request.post(`${GATEWAY_URL}/api/v1/tickets`, {
        headers: { Authorization: `Bearer ${globexToken}` },
        data: {
          subject: 'Globex Confidential Cargo Transit Issue #99',
          description: 'Shipment manifest 992-B container locked in transit.',
          priority: 'HIGH',
        },
      });
      expect(createRes.status()).toBe(201);
      const created = await createRes.json();
      const ticket = created.data || created;
      globexTicketId = ticket._id || ticket.id;
      globexTicketSubject = ticket.subject;
    }

    expect(globexTicketId).toBeDefined();

    // 2. Authenticate as Acme Corporation user (admin@acme.com)
    const acmeLoginRes = await request.post(`${GATEWAY_URL}/api/v1/auth/login`, {
      data: {
        email: 'admin@acme.com',
        password: 'Password123!',
      },
    });
    expect(acmeLoginRes.status()).toBe(200);
    const acmeLoginData = await acmeLoginRes.json();
    const acmeToken =
      acmeLoginData.data?.tokens?.accessToken ||
      acmeLoginData.data?.accessToken ||
      acmeLoginData.tokens?.accessToken ||
      acmeLoginData.accessToken ||
      acmeLoginData.token;

    // 3. Direct API: Acme agent attempts to query Globex ticket -> MUST return 403 or 404
    const crossQueryRes = await request.get(`${GATEWAY_URL}/api/v1/tickets/${globexTicketId}`, {
      headers: { Authorization: `Bearer ${acmeToken}` },
    });
    expect([403, 404]).toContain(crossQueryRes.status());
    expect(crossQueryRes.status()).not.toBe(200);

    // 4. Direct API: Acme agent attempts to mutate Globex ticket -> MUST return 403 or 404
    const crossPatchRes = await request.patch(`${GATEWAY_URL}/api/v1/tickets/${globexTicketId}`, {
      headers: {
        Authorization: `Bearer ${acmeToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        status: 'RESOLVED',
        version: 1,
      },
    });
    expect([403, 404]).toContain(crossPatchRes.status());
    expect(crossPatchRes.status()).not.toBe(200);

    // 5. UI Isolation: Acme agent in Dashboard cannot see Globex ticket
    await page.goto(DASHBOARD_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.locator('[data-testid="login-email-input"]').fill('admin@acme.com');
    await page.locator('[data-testid="login-password-input"]').fill('Password123!');
    await page.locator('[data-testid="login-submit-button"]').click();

    const ticketsTable = page.locator('[data-testid="tickets-table"]');
    await expect(ticketsTable).toBeVisible({ timeout: 15000 });

    if (globexTicketSubject) {
      await expect(page.locator(`text=${globexTicketSubject}`)).not.toBeVisible();
    }
  });
});
