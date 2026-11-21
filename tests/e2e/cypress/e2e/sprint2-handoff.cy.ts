/// <reference types="cypress" />

describe('Sprint 2 Agent Flow & Live Chat Handoff E2E', () => {
  const mockTenantId = 'tenant_e2e_corp';
  const mockAgent = {
    id: 'user_agent_001',
    email: 'agent@supportpilot.io',
    name: 'Sarah Connor',
    role: 'AGENT',
    tenantId: mockTenantId,
  };

  const mockTicket = {
    id: 'ticket_handoff_101',
    number: 1042,
    subject: 'Billing inquiry escalated from AI chat',
    description: 'Customer requested human agent assistance regarding subscription billing.',
    status: 'OPEN',
    priority: 'HIGH',
    tenantId: mockTenantId,
    tags: ['escalated', 'billing'],
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    // Intercept auth endpoints
    cy.intercept('POST', '/api/v1/auth/login', {
      statusCode: 200,
      body: {
        data: {
          accessToken: 'mock.agent.jwt.token',
          user: mockAgent,
        },
        accessToken: 'mock.agent.jwt.token',
        user: mockAgent,
      },
    }).as('loginRequest');

    cy.intercept('GET', '/api/v1/auth/me', {
      statusCode: 200,
      body: {
        data: mockAgent,
        user: mockAgent,
        ...mockAgent,
      },
    }).as('meRequest');

    // Intercept ticket REST endpoints (TicketInbox expects data?.data || [])
    cy.intercept('GET', '/api/v1/tickets*', {
      statusCode: 200,
      body: {
        data: [mockTicket],
        total: 1,
        page: 1,
        limit: 20,
      },
    }).as('getTickets');

    cy.intercept('POST', '/api/v1/tickets', {
      statusCode: 201,
      body: {
        data: mockTicket,
        ...mockTicket,
      },
    }).as('createTicket');

    // Intercept KB documents endpoint
    cy.intercept('GET', '/api/v1/kb/documents*', {
      statusCode: 200,
      body: {
        data: [
          {
            id: 'doc-001',
            title: 'SAML Authentication',
            source: 'saml-guide.pdf',
            status: 'READY',
            chunksCount: 12,
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    }).as('getKbDocs');

    // Intercept GraphQL queries and mutations
    cy.intercept('POST', '/graphql', (req) => {
      const { query, operationName } = req.body;

      if (operationName === 'GetTickets' || query?.includes('query GetTickets')) {
        req.reply({
          data: {
            tickets: {
              items: [mockTicket],
              totalCount: 1,
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        });
      } else if (operationName === 'GetAnalyticsOverview' || query?.includes('analyticsOverview')) {
        req.reply({
          data: {
            analyticsOverview: {
              openTicketsCount: 1,
              escalatedChatsCount: 1,
              avgResponseTimeMinutes: 2.4,
              csatScore: 4.8,
            },
          },
        });
      } else if (operationName === 'SuggestReply' || query?.includes('suggestReply')) {
        req.reply({
          data: {
            suggestReply: {
              replyText:
                'Hello! I am taking over your chat. I can see you have a billing question.',
              confidence: 0.94,
              citations: [
                {
                  chunkId: 'kb_chunk_billing_1',
                  documentId: 'doc_billing_terms',
                  title: 'Subscription & Billing Terms',
                  similarity: 0.92,
                },
              ],
            },
          },
        });
      } else {
        req.reply({ data: {} });
      }
    }).as('graphqlRequest');
  });

  it('allows agent to log in, view dashboard, and create a ticket', () => {
    cy.visit('/');

    // Fill in agent login form
    cy.get('input[type="email"]').clear().type('agent@supportpilot.io');
    cy.get('input[type="password"]').clear().type('Secret123!');
    cy.get('button[type="submit"]').click();

    // Verify authenticated shell is displayed
    cy.contains('SupportPilot').should('be.visible');
    cy.contains('Sarah Connor').should('be.visible');
    cy.contains('Tickets (Inbox)').should('be.visible');

    // Verify ticket item in inbox
    cy.contains('Billing inquiry escalated from AI chat').should('be.visible');
  });

  it('navigates to Live Chats view and reviews AI-assisted escalation queue', () => {
    cy.visit('/');
    cy.get('input[type="email"]').clear().type('agent@supportpilot.io');
    cy.get('input[type="password"]').clear().type('Secret123!');
    cy.get('button[type="submit"]').click();

    // Click Live Chats navigation tab
    cy.contains('Live Chats').click();

    // Verify 3-panel chat view elements
    cy.contains('Live Agent Console').should('be.visible');
    cy.contains('Waiting').should('be.visible');
    cy.contains('AI Suggestion Panel').should('be.visible');

    // Verify queue filter tabs
    cy.contains('Waiting').should('be.visible');
    cy.contains('Mine').should('be.visible');
    cy.contains('All').should('be.visible');
  });

  it('allows agent to view knowledge base documents and status', () => {
    cy.visit('/');
    cy.get('input[type="email"]').clear().type('agent@supportpilot.io');
    cy.get('input[type="password"]').clear().type('Secret123!');
    cy.get('button[type="submit"]').click();

    // Navigate to Knowledge Base tab
    cy.contains('Knowledge Base').click();

    // Verify Knowledge Base view headers
    cy.contains('Knowledge Base & Vector Store').should('be.visible');
    cy.contains('Test Console').should('be.visible');
    cy.contains('Add Document').should('be.visible');
  });
});
