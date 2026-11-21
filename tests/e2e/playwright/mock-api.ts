import type { Page, Route } from '@playwright/test';

export interface MockStore {
  tickets: Array<{
    id: string;
    number: number;
    subject: string;
    description: string;
    priority: string;
    status: string;
    customerId?: string;
    customerEmail?: string;
    assigneeId?: string;
    tags: string[];
    version: number;
    createdAt: string;
    updatedAt: string;
  }>;
  kbDocuments: Array<{
    id: string;
    title: string;
    source: string;
    status: string;
    chunksCount: number;
    updatedAt: string;
  }>;
  chatMessages: Array<{
    id: string;
    senderType: 'CUSTOMER' | 'AGENT' | 'AI' | 'SYSTEM';
    body: string;
    createdAt: string;
  }>;
}

export function createInitialMockStore(): MockStore {
  return {
    tickets: [
      {
        id: 'tkt_001',
        number: 1001,
        subject: 'Cannot login with SAML Okta integration',
        description: 'Customer reports 403 signature mismatch on SAML callback assertion.',
        priority: 'HIGH',
        status: 'OPEN',
        customerEmail: 'admin@acme-corp.com',
        assigneeId: 'usr_alex_001',
        tags: ['auth', 'saml', 'enterprise'],
        version: 1,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        id: 'tkt_002',
        number: 1002,
        subject: 'Monthly invoice receipt download failed',
        description: 'Need copy of November invoice receipt for accounting.',
        priority: 'LOW',
        status: 'NEW',
        customerEmail: 'finance@globex.com',
        tags: ['billing', 'invoice'],
        version: 1,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        updatedAt: new Date(Date.now() - 7200000).toISOString(),
      },
    ],
    kbDocuments: [
      {
        id: 'doc_kb_101',
        title: 'SAML 2.0 Identity Provider Configuration Guide',
        source: 'manual',
        status: 'READY',
        chunksCount: 8,
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'doc_kb_102',
        title: 'Stripe Billing & Invoices Automated Synchronization',
        source: 'manual',
        status: 'READY',
        chunksCount: 5,
        updatedAt: new Date(Date.now() - 172800000).toISOString(),
      },
    ],
    chatMessages: [],
  };
}

export async function setupMockApi(page: Page, customStore?: MockStore) {
  const store = customStore || createInitialMockStore();
  const isRealApi = process.env.E2E_REAL_API === 'true';

  // 1. Socket.IO Handshake Interception
  await page.route('**/socket.io/**', async (route: Route) => {
    if (isRealApi) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sid: 'mock-socket-session-playwright',
        upgrades: [],
        pingInterval: 25000,
        pingTimeout: 20000,
      }),
    });
  });

  // Notifications Route
  await page.route('**/api/v1/notifications**', async (route: Route) => {
    if (isRealApi) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });

  // 2. Auth Routes
  await page.route('**/api/v1/auth/login', async (route: Route) => {
    if (isRealApi) {
      await route.fallback();
      return;
    }
    const postData = route.request().postDataJSON() || {};
    const { email, password } = postData;

    if (email === 'ratelimit@company.com') {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'https://supportpilot.io/errors/too-many-requests',
          title: 'Too Many Requests',
          status: 429,
          detail: 'Rate limit exceeded: 5 attempts per 15 minutes',
        }),
      });
      return;
    }

    if (password === 'WrongPassword!' || email === 'unknown@company.com') {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'https://supportpilot.io/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid email or password',
        }),
      });
      return;
    }

    // Success response
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          user: {
            id: 'usr_alex_001',
            email: email || 'alex.vance@company.com',
            name: 'Alex Vance',
            role: 'AGENT',
            tenantId: '507f1f77bcf86cd799439011',
          },
          tokens: {
            accessToken: 'mock-jwt-access-token-alex-vance',
            refreshToken: 'mock-jwt-refresh-token-alex-vance',
          },
        },
      }),
    });
  });

  await page.route('**/api/v1/auth/logout', async (route: Route) => {
    if (isRealApi) {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 204 });
  });

  // 3. Cross-Tenant Forbidden Route
  await page.route('**/api/v1/tickets/tkt_tenant_b_secret*', async (route: Route) => {
    if (isRealApi) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 403,
      contentType: 'application/problem+json',
      body: JSON.stringify({
        type: 'https://supportpilot.io/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: 'Cross-tenant access forbidden',
      }),
    });
  });

  // 4. Public Ticket Routes
  await page.route('**/api/v1/tickets/public/track*', async (route: Route) => {
    if (isRealApi) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          ticket: {
            id: 'tkt_track_pub_1',
            number: 8821,
            subject: 'HEV suit battery depletion in sector C',
            description: 'Need urgent technical replacement battery pack.',
            status: 'NEW',
            priority: 'MEDIUM',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          timeline: [],
          messages: [],
        },
      }),
    });
  });

  await page.route('**/api/v1/tickets/public', async (route: Route) => {
    if (isRealApi) {
      await route.fallback();
      return;
    }
    const body = route.request().postDataJSON() || {};
    const newNumber = 8800 + store.tickets.length + 1;
    const newTicket = {
      id: `tkt_pub_${Date.now()}`,
      number: newNumber,
      subject: body.subject || 'Offline message from website',
      description: body.description || '',
      priority: body.priority || 'MEDIUM',
      status: 'NEW',
      customerEmail: body.email,
      tags: ['offline-widget'],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.tickets.unshift(newTicket);

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: newTicket.id,
          number: newTicket.number,
          subject: newTicket.subject,
          status: newTicket.status,
        },
      }),
    });
  });

  // 5. Individual Ticket Detail & Update Routes
  await page.route(/\/api\/v1\/tickets\/tkt_[a-zA-Z0-9_-]+$/, async (route: Route) => {
    if (isRealApi) {
      await route.fallback();
      return;
    }
    const method = route.request().method();
    const url = route.request().url();
    const ticketId = url.split('/').pop()?.split('?')[0];

    const ticket = store.tickets.find((t) => t.id === ticketId);
    if (!ticket) {
      await route.fulfill({
        status: 404,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: 'https://supportpilot.io/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'Ticket not found',
        }),
      });
      return;
    }

    if (method === 'PATCH') {
      const patchData = route.request().postDataJSON() || {};
      // Concurrency conflict check: if supplied version does not match current version
      if (typeof patchData.version === 'number' && patchData.version !== ticket.version) {
        await route.fulfill({
          status: 409,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            type: 'https://supportpilot.io/errors/conflict',
            title: 'Conflict',
            status: 409,
            detail: 'Ticket was modified by another user',
          }),
        });
        return;
      }

      // Update ticket fields
      if (patchData.status) ticket.status = patchData.status;
      if (patchData.priority) ticket.priority = patchData.priority;
      if (patchData.assigneeId) ticket.assigneeId = patchData.assigneeId;
      if (patchData.tags) ticket.tags = patchData.tags;
      ticket.version += 1;
      ticket.updatedAt = new Date().toISOString();

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: ticket }),
      });
      return;
    }

    // Default GET
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          ticket,
          timeline: [
            {
              id: 'evt_1',
              ticketId: ticket.id,
              type: 'CREATED',
              actorId: 'usr_customer_1',
              actorName: ticket.customerEmail || 'Customer',
              createdAt: ticket.createdAt,
            },
          ],
          messages: [
            {
              id: `msg_${ticket.id}_1`,
              ticketId: ticket.id,
              senderType: 'CUSTOMER',
              body: ticket.description,
              isInternal: false,
              createdAt: ticket.createdAt,
            },
          ],
        },
      }),
    });
  });

  // 6. Tickets List & Create Routes
  await page.route('**/api/v1/tickets?*', async (route: Route) => {
    if (isRealApi) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: store.tickets,
        meta: { cursor: null, hasMore: false },
      }),
    });
  });

  await page.route('**/api/v1/tickets', async (route: Route) => {
    if (isRealApi) {
      await route.fallback();
      return;
    }
    const method = route.request().method();
    if (method === 'POST') {
      const payload = route.request().postDataJSON() || {};
      const newNum = 1000 + store.tickets.length + 1;
      const createdTicket = {
        id: `tkt_${Date.now()}`,
        number: newNum,
        subject: payload.subject || 'New Ticket',
        description: payload.description || '',
        priority: payload.priority || 'MEDIUM',
        status: 'NEW',
        customerEmail: payload.customerEmail || 'user@example.com',
        tags: payload.tags || ['billing', 'enterprise'],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.tickets.unshift(createdTicket);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: createdTicket }),
      });
      return;
    }

    // Fallback GET
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: store.tickets,
        meta: { cursor: null, hasMore: false },
      }),
    });
  });

  // 7. Knowledge Base Routes
  await page.route('**/api/v1/kb/documents', async (route: Route) => {
    if (isRealApi) {
      await route.fallback();
      return;
    }
    const method = route.request().method();
    if (method === 'POST') {
      const payload = route.request().postDataJSON() || {};
      const newDoc = {
        id: `doc_${Date.now()}`,
        title: payload.title || 'Untitled Document',
        source: payload.source || 'manual',
        status: 'PROCESSING',
        chunksCount: 0,
        updatedAt: new Date().toISOString(),
      };
      store.kbDocuments.unshift(newDoc);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            documentId: newDoc.id,
            title: newDoc.title,
            status: newDoc.status,
            chunksCount: newDoc.chunksCount,
          },
        }),
      });

      // Automatically transition to READY after 800ms
      setTimeout(() => {
        newDoc.status = 'READY';
        newDoc.chunksCount = 4;
      }, 800);
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: store.kbDocuments }),
    });
  });

  // 8. AI Service Answer & Assist Routes
  await page.route('**/api/v1/ai/answer', async (route: Route) => {
    if (isRealApi) {
      await route.fallback();
      return;
    }
    const payload = route.request().postDataJSON() || {};
    const query = (payload.question || '').toLowerCase();

    if (query.includes('mars') || query.includes('cake') || query.includes('unanswerable')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          answer: 'Unable to assist with out-of-scope inquiries. Escalating to human agent.',
          citations: [],
          confidence: 0.32,
          shouldEscalate: true,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        answer:
          'SupportPilot encrypts all customer data at rest with AES-256 and in transit using TLS 1.3 encryption standards.',
        citations: [
          {
            chunkId: 'chunk_sec_01',
            docId: 'doc_kb_101',
            title: 'SOC-2 Compliance and Data Encryption Standards',
          },
        ],
        confidence: 0.94,
        shouldEscalate: false,
      }),
    });
  });

  await page.route('**/api/v1/ai/assist/suggest-reply', async (route: Route) => {
    if (isRealApi) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        suggestion:
          'Hello! I can look into your SAML certificate renewal and help resolve this immediately.',
        confidence: 0.92,
        citations: [
          {
            chunkId: 'chunk_saml_01',
            docId: 'doc_kb_101',
            title: 'SAML Authentication',
          },
        ],
        latencyMs: 35,
      }),
    });
  });

  // 9. Analytics Overview Fallback
  await page.route('**/api/v1/analytics/**', async (route: Route) => {
    if (isRealApi) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          open: store.tickets.filter((t) => t.status === 'OPEN').length,
          newToday: store.tickets.filter((t) => t.status === 'NEW').length,
          medianFirstResponseMin: 14,
          medianResolutionMin: 65,
          slaCompliance: 98.4,
          deflectionRate: 46.2,
        },
      }),
    });
  });

  return store;
}
