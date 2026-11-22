/// <reference types="cypress" />

describe('RBAC Matrix & Multi-Role Authorization Suite', () => {
  const tenantId = 'tenant_rbac_matrix_corp';

  const mockUsers = {
    owner: {
      id: 'usr_owner_001',
      email: 'owner@acme.com',
      name: 'Alice Owner',
      role: 'OWNER',
      tenantId,
    },
    lead: {
      id: 'usr_lead_002',
      email: 'lead@acme.com',
      name: 'Bob Lead',
      role: 'LEAD',
      tenantId,
    },
    agent: {
      id: 'usr_agent_003',
      email: 'agent@acme.com',
      name: 'Charlie Agent',
      role: 'AGENT',
      tenantId,
    },
    viewer: {
      id: 'usr_viewer_004',
      email: 'viewer@acme.com',
      name: 'Diana Viewer',
      role: 'VIEWER',
      tenantId,
    },
  };

  const mockTicket = {
    id: 'ticket_rbac_101',
    number: 1042,
    subject: 'Enterprise SSO federation error',
    description: 'SAML assertion rejected with invalid signature.',
    status: 'OPEN',
    priority: 'HIGH',
    tenantId,
    tags: ['sso', 'security'],
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const setupRoleSession = (user: typeof mockUsers.owner) => {
    cy.intercept('POST', '/api/v1/auth/login', {
      statusCode: 200,
      body: {
        data: {
          accessToken: `jwt.token.${user.role.toLowerCase()}`,
          user,
        },
        accessToken: `jwt.token.${user.role.toLowerCase()}`,
        user,
      },
    }).as('loginRequest');

    cy.intercept('GET', '/api/v1/auth/me', {
      statusCode: 200,
      body: {
        data: user,
        user,
        ...user,
      },
    }).as('meRequest');

    cy.intercept('GET', '/api/v1/tickets*', {
      statusCode: 200,
      body: {
        data: [mockTicket],
        total: 1,
        page: 1,
        limit: 20,
      },
    }).as('getTickets');

    cy.intercept('GET', '/api/v1/billing/subscription', {
      statusCode: 200,
      body: {
        data: {
          tier: 'ENTERPRISE',
          status: 'ACTIVE',
          currentPeriodEnd: '2026-12-31T23:59:59Z',
          limits: { messages: 50000, ai: 5000, kb: 50 * 1024 * 1024 },
          usage: { messages: 1240, ai: 420, kb: 12 * 1024 * 1024 },
        },
      },
    }).as('getSubscription');

    cy.intercept('GET', '/api/v1/team', {
      statusCode: 200,
      body: {
        data: [
          {
            id: mockUsers.owner.id,
            name: mockUsers.owner.name,
            email: mockUsers.owner.email,
            role: 'OWNER',
            status: 'ACTIVE',
            joinedAt: '2026-01-01T00:00:00Z',
          },
          {
            id: mockUsers.lead.id,
            name: mockUsers.lead.name,
            email: mockUsers.lead.email,
            role: 'LEAD',
            status: 'ACTIVE',
            joinedAt: '2026-01-10T00:00:00Z',
          },
          {
            id: mockUsers.agent.id,
            name: mockUsers.agent.name,
            email: mockUsers.agent.email,
            role: 'AGENT',
            status: 'ACTIVE',
            joinedAt: '2026-01-15T00:00:00Z',
          },
        ],
      },
    }).as('getTeam');

    cy.intercept('GET', '/api/v1/api-keys', {
      statusCode: 200,
      body: {
        data: [
          {
            id: 'key_001',
            name: 'Production Ingestion Key',
            prefix: 'sp_live_9f8a',
            scopes: ['tickets:read', 'tickets:write'],
            createdAt: '2026-02-01T00:00:00Z',
          },
        ],
      },
    }).as('getApiKeys');
  };

  const loginAs = (user: typeof mockUsers.owner) => {
    setupRoleSession(user);
    cy.visit('/');
    cy.get('input[type="email"]').clear().type(user.email);
    cy.get('input[type="password"]').clear().type('SecretPassword123!');
    cy.get('button[type="submit"]').click();
    cy.contains('SupportPilot').should('be.visible');
    cy.contains(user.name).should('be.visible');
  };

  describe('Tier 1: Role Permissions & Privileged View Rendering', () => {
    it('TC-T1-RBAC-04: OWNER role has access to Platform Cockpit, Billing, and Team Admin', () => {
      loginAs(mockUsers.owner);

      // Verify Platform Cockpit navigation is present for OWNER
      cy.get('[data-testid="nav-admin"]').should('be.visible');
      cy.contains('Platform Cockpit').should('be.visible');

      // Verify Settings access with Platform Admin tab
      cy.contains('Settings').click();
      cy.contains('Platform Admin').should('be.visible');

      // Verify Billing tab view
      cy.contains('Billing & Plans').click();
      cy.contains('Enterprise SupportPilot').should('be.visible');

      // Verify Team view
      cy.contains('Team').click();
      cy.contains('Workspace Owner').should('be.visible');
    });

    it('TC-T1-RBAC-03: LEAD role can access Team and Automation but NOT Platform Cockpit', () => {
      loginAs(mockUsers.lead);

      // Platform Cockpit navigation must NOT exist for LEAD
      cy.get('[data-testid="nav-admin"]').should('not.exist');
      cy.contains('Platform Cockpit').should('not.exist');

      // LEAD can access Automation & SLA
      cy.contains('Automation & SLA').should('be.visible');

      // LEAD can access Team management
      cy.contains('Team').click();
      cy.contains('Team Lead').should('be.visible');

      // In Settings, Platform Admin subtab must NOT exist
      cy.contains('Settings').click();
      cy.contains('Platform Admin').should('not.exist');
    });

    it('TC-T1-RBAC-01: AGENT role has access to Inbox and Live Chats but NOT Cockpit or Admin subtab', () => {
      loginAs(mockUsers.agent);

      // Verify core support agent views
      cy.contains('Tickets (Inbox)').should('be.visible');
      cy.contains('Live Chats').should('be.visible');

      // Forbidden views for AGENT
      cy.get('[data-testid="nav-admin"]').should('not.exist');
      cy.contains('Platform Cockpit').should('not.exist');

      cy.contains('Settings').click();
      cy.contains('Platform Admin').should('not.exist');
    });

    it('TC-T1-RBAC-02: VIEWER role can inspect tickets and read-only settings', () => {
      loginAs(mockUsers.viewer);

      // VIEWER sees ticket inbox
      cy.contains('Tickets (Inbox)').should('be.visible');
      cy.contains('Enterprise SSO federation error').should('be.visible');

      // Forbidden views for VIEWER
      cy.get('[data-testid="nav-admin"]').should('not.exist');
      cy.contains('Platform Cockpit').should('not.exist');
    });
  });

  describe('Tier 2: Authorization Boundaries & 403 Forbidden Defense', () => {
    it('TC-T2-RBAC-01 & TC-T2-RBAC-02: Denies unprivileged mutations with HTTP 403 Forbidden', () => {
      loginAs(mockUsers.viewer);

      // Verify UI role restrictions: Platform Admin subtab is hidden for VIEWER
      cy.contains('Settings').click();
      cy.contains('Platform Admin').should('not.exist');

      // TC-T2-RBAC-01: Genuinely send unprivileged ticket mutation via cy.request
      cy.request({
        method: 'POST',
        url: '/api/v1/tickets',
        headers: {
          Authorization: `Bearer jwt.token.${mockUsers.viewer.role.toLowerCase()}`,
          'x-tenant-id': tenantId,
        },
        body: {
          subject: 'Unauthorized ticket create attempt',
          description: 'Viewer role lacks ticket create permission',
          priority: 'MEDIUM',
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(403);
        expect(response.body).to.have.property('status', 403);
        expect(response.body).to.have.property('type');
        expect(response.body.type).to.match(/forbidden/);
        expect(response.body.detail || response.body.title).to.include('permission');
      });

      // TC-T2-RBAC-02: Genuinely send unprivileged API key mutation via cy.request
      cy.request({
        method: 'POST',
        url: '/api/v1/api-keys',
        headers: {
          Authorization: `Bearer jwt.token.${mockUsers.viewer.role.toLowerCase()}`,
          'x-tenant-id': tenantId,
        },
        body: {
          name: 'Unauthorized API Key Attempt',
          scopes: ['tickets:read', 'tickets:write'],
        },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(403);
        expect(response.body).to.have.property('status', 403);
        expect(response.body).to.have.property('type');
        expect(response.body.type).to.match(/forbidden/);
      });
    });

    it('TC-T2-RBAC-04 & TC-T2-RBAC-05: Unauthenticated access redirects or displays error', () => {
      cy.intercept('POST', '/api/v1/auth/login', {
        statusCode: 401,
        body: {
          type: 'https://supportpilot.io/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid credentials or inactive session',
        },
      }).as('unauthorizedLogin');

      cy.visit('/');
      cy.get('input[type="email"]').clear().type('intruder@unknown.com');
      cy.get('input[type="password"]').clear().type('WrongPassword!');
      cy.get('button[type="submit"]').click();
      cy.wait('@unauthorizedLogin');

      // Ensure user remains on login view and receives rejection
      cy.get('button[type="submit"]').should('be.visible');
      cy.contains('SupportPilot').should('be.visible');
    });
  });

  describe('Tier 3: Multi-Role Session Isolation & Cross-Role Consistency', () => {
    it('TC-T3-09: Role elevation and degradation across sequential sessions', () => {
      // 1. Session A: AGENT logs in
      loginAs(mockUsers.agent);
      cy.get('[data-testid="nav-admin"]').should('not.exist');

      // 2. Session B: OWNER logs in
      loginAs(mockUsers.owner);
      cy.get('[data-testid="nav-admin"]').should('be.visible');
      cy.contains('Platform Cockpit').should('be.visible');
    });
  });
});
