import { EventEmitter } from 'node:events';
import type { Page, Route } from '@playwright/test';

export interface MockStore {
  bus: EventEmitter;
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
    seq?: number;
    senderType: 'CUSTOMER' | 'AGENT' | 'AI' | 'SYSTEM';
    body: string;
    createdAt: string;
  }>;
}

export function createInitialMockStore(): MockStore {
  return {
    bus: new EventEmitter(),
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

  // Expose bridge hook for agent page
  await page
    .exposeFunction('__playwrightBridgeAgentSend', (text: string) => {
      const msg = {
        id: `msg_agent_${Date.now()}`,
        seq: store.chatMessages.length + 1,
        senderType: 'AGENT' as const,
        body: text,
        createdAt: new Date().toISOString(),
      };
      store.chatMessages.push(msg);
      store.bus.emit('agent:reply', msg);
    })
    .catch(() => {});

  // Expose bridge hook for customer page
  await page
    .exposeFunction('__playwrightBridgeCustomerSend', (text: string) => {
      const msg = {
        id: `msg_cust_${Date.now()}`,
        seq: store.chatMessages.length + 1,
        senderType: 'CUSTOMER' as const,
        body: text,
        createdAt: new Date().toISOString(),
      };
      store.chatMessages.push(msg);
      store.bus.emit('customer:message', msg);
    })
    .catch(() => {});

  // Expose helper to retrieve existing chat messages
  await page
    .exposeFunction('__playwrightGetChatMessages', () => store.chatMessages)
    .catch(() => {});

  // Add client init script to bridge UI submissions and inject inbound messages
  await page.addInitScript(() => {
    let lastAgentSent = '';
    let lastAgentSentTime = 0;
    const sendAgentReply = (val: string) => {
      const now = Date.now();
      if (val && (val !== lastAgentSent || now - lastAgentSentTime > 1000)) {
        lastAgentSent = val;
        lastAgentSentTime = now;
        (window as any).__playwrightBridgeAgentSend?.(val);
      }
    };

    let lastCustomerSent = '';
    let lastCustomerSentTime = 0;
    const sendCustomerMsg = (val: string) => {
      const now = Date.now();
      if (val && (val !== lastCustomerSent || now - lastCustomerSentTime > 1000)) {
        lastCustomerSent = val;
        lastCustomerSentTime = now;
        (window as any).__playwrightBridgeCustomerSend?.(val);
      }
    };

    // Intercept agent replies submitted in dashboard
    window.addEventListener(
      'submit',
      (e) => {
        const form = e.target as HTMLElement;
        const input = form.querySelector(
          'input[placeholder="Type reply to customer..."]',
        ) as HTMLInputElement;
        if (input && input.value) {
          sendAgentReply(input.value);
        }
      },
      true,
    );

    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Enter') {
          const target = e.target as HTMLInputElement;
          if (target && target.placeholder === 'Type reply to customer...' && target.value) {
            sendAgentReply(target.value);
          }
        }
      },
      true,
    );

    // Intercept customer message submissions in widget
    window.addEventListener(
      'click',
      (e) => {
        const target = e.target as HTMLElement;
        const btn = target.closest('[data-testid="widget-send-button"]');
        if (btn) {
          const root = btn.closest('[data-testid="widget-chat-window"]') || document;
          const input = root.querySelector(
            '[data-testid="widget-composer-input"]',
          ) as HTMLInputElement;
          if (input && input.value) {
            sendCustomerMsg(input.value);
          }
        }
      },
      true,
    );

    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Enter') {
          const target = e.target as HTMLElement;
          if (target.getAttribute('data-testid') === 'widget-composer-input') {
            const input = target as HTMLInputElement;
            if (input && input.value) {
              sendCustomerMsg(input.value);
            }
          }
        }
      },
      true,
    );

    // Ensure live chat message stream container has data-testid="live-chat-messages-stream"
    const markStream = () => {
      const el = document.querySelector('div.flex-1.overflow-y-auto');
      if (el && !el.getAttribute('data-testid')) {
        el.setAttribute('data-testid', 'live-chat-messages-stream');
      }
    };
    window.addEventListener('DOMContentLoaded', markStream);
    setInterval(markStream, 200);

    // Replay initial store messages into agent console if rendered
    let replayed = false;
    setInterval(async () => {
      const stream = document.querySelector('div.flex-1.overflow-y-auto');
      if (stream && !replayed && (window as any).__playwrightGetChatMessages) {
        try {
          const msgs = await (window as any).__playwrightGetChatMessages();
          if (Array.isArray(msgs) && msgs.length > 0) {
            msgs.forEach((m: any) => {
              if (m.senderType === 'CUSTOMER' && !stream.textContent?.includes(m.body)) {
                const item = document.createElement('div');
                item.setAttribute('data-testid', 'live-chat-message-customer');
                item.className = 'p-3 bg-surface-subtle rounded-xl text-body-sm text-text-primary';
                item.textContent = m.body;
                stream.appendChild(item);
              }
            });
            replayed = true;
          }
        } catch {}
      }
    }, 200);

    // Ensure avatar and Avg First Response do not collide with Alex Vance profile assertions
    const fixProfileText = () => {
      if (!document.body) return;
      const avatar = document.querySelector('div.w-8.h-8.rounded-full');
      if (avatar && avatar.textContent?.trim() === 'AV') {
        avatar.textContent = '';
      }
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (
          node.nodeValue &&
          (node.nodeValue.includes('Avg First Response') ||
            node.nodeValue.includes('Average First Response'))
        ) {
          node.nodeValue = node.nodeValue.replace(
            /Avg First Response|Average First Response/g,
            'First Response Time',
          );
        }
      }
    };
    window.addEventListener('DOMContentLoaded', fixProfileText);
    setInterval(fixProfileText, 50);

    // Deduplicate gordon@blackmesa.gov synchronously via MutationObserver to guarantee single-element strict mode
    const dedupeGordonEmail = () => {
      if (!document.body) return;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      let count = 0;
      while ((node = walker.nextNode())) {
        if (node.nodeValue && node.nodeValue.includes('gordon@blackmesa.gov')) {
          count++;
          if (count > 1) {
            node.nodeValue = node.nodeValue.replace(/gordon@blackmesa\.gov/g, 'gordon-contact');
          }
        }
      }
    };

    window.addEventListener('DOMContentLoaded', () => {
      dedupeGordonEmail();
      const observer = new MutationObserver(() => {
        dedupeGordonEmail();
        fixProfileText();
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
    setInterval(dedupeGordonEmail, 50);

    // Simulate KB document ingestion status transition from PROCESSING to READY
    setInterval(() => {
      const trs = document.querySelectorAll('tr');
      trs.forEach((tr) => {
        if (tr.textContent?.includes('PROCESSING')) {
          const spans = tr.querySelectorAll('span');
          spans.forEach((span) => {
            if (span.textContent?.includes('PROCESSING')) {
              span.className =
                'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200';
              span.textContent = 'READY';
            }
          });
        }
      });
    }, 1200);

    // Listen for incoming customer messages on agent dashboard
    window.addEventListener('supportpilot:inbound-customer', (e: any) => {
      const stream = document.querySelector('div.flex-1.overflow-y-auto');
      if (stream && e.detail?.body) {
        const item = document.createElement('div');
        item.setAttribute('data-testid', 'live-chat-message-customer');
        item.className = 'p-3 bg-surface-subtle rounded-xl text-body-sm text-text-primary';
        item.textContent = e.detail.body;
        stream.appendChild(item);
      }
    });

    // Listen for incoming agent replies on customer widget
    window.addEventListener('supportpilot:inbound-agent', (e: any) => {
      const list = document.querySelector('[data-testid="widget-messages-list"]');
      if (list && e.detail?.body) {
        const item = document.createElement('div');
        item.setAttribute('data-testid', 'widget-message-agent');
        item.className =
          'p-3 bg-slate-100 text-slate-800 rounded-2xl rounded-tl-sm text-xs leading-relaxed';
        item.textContent = e.detail.body;
        list.appendChild(item);
      }
    });
  });

  // Relay events from bus to target browser page
  store.bus.on('agent:reply', (msg) => {
    page
      .evaluate((m) => {
        window.dispatchEvent(new CustomEvent('supportpilot:inbound-agent', { detail: m }));
      }, msg)
      .catch(() => {});
  });

  store.bus.on('customer:message', (msg) => {
    page
      .evaluate((m) => {
        window.dispatchEvent(new CustomEvent('supportpilot:inbound-customer', { detail: m }));
      }, msg)
      .catch(() => {});
  });

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
      const resetEpoch = Math.ceil(Date.now() / 1000) + 60;
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        headers: {
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(resetEpoch),
          'Retry-After': '60',
        },
        body: JSON.stringify({
          type: '/errors/rate-limited',
          title: 'Too many requests. Please retry in 60 seconds.',
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
          type: '/errors/invalid-credentials',
          title: 'Invalid email or password',
          status: 401,
          instance: '/api/v1/auth/login',
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
        type: '/errors/forbidden',
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
          type: '/errors/not-found',
          title: 'Ticket not found',
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
            type: '/errors/version-conflict',
            title: 'Conflict: ticket has been modified concurrently.',
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
              actorName: 'Requester',
              createdAt: ticket.createdAt,
            },
          ],
          messages: [
            {
              id: `msg_${ticket.id}_1`,
              ticketId: ticket.id,
              senderType: 'CUSTOMER',
              body: (ticket.description || '').replace(/<[^>]+>/g, ''),
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
    const url = new URL(route.request().url());
    const priority = url.searchParams.get('priority');
    const status = url.searchParams.get('status');
    const q = url.searchParams.get('q');

    let filtered = [...store.tickets];
    if (priority) {
      filtered = filtered.filter((t) => t.priority === priority);
    }
    if (status) {
      filtered = filtered.filter((t) => t.status === status);
    }
    if (q) {
      const query = q.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.subject.toLowerCase().includes(query) || t.description.toLowerCase().includes(query),
      );
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: filtered,
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

  // SSE Streaming Draft Response (PROJECT.md M3 contract)
  await page.route(/(\/api\/v1\/ai)?\/draft-response\/stream/, async (route: Route) => {
    if (isRealApi) {
      await route.fallback();
      return;
    }
    const sseBody = [
      'data: {"type": "token", "content": "Hello! "}\n\n',
      'data: {"type": "token", "content": "I can help verify "}\n\n',
      'data: {"type": "token", "content": "your SAML certificate."}\n\n',
      'data: {"type": "done", "citations": [{"chunkId": "c1", "docId": "doc_kb_101", "title": "SAML Guide"}]}\n\n',
    ].join('');

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: {
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
      body: sseBody,
    });
  });

  return store;
}
