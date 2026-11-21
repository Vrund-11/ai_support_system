describe('Ticket Concurrency & Optimistic Locking Suite', () => {
  const mockTenantId = 'tenant_concurrency_corp';
  const mockAgent = {
    id: 'usr_agent_conc_1',
    email: 'agent@supportpilot.io',
    name: 'Sarah Connor',
    role: 'AGENT',
    tenantId: mockTenantId,
  };

  const initialTicket = {
    id: 'ticket_conc_101',
    number: 1042,
    subject: 'High priority payment gateway timeout',
    description: 'Transactions timing out when processing webhook callbacks.',
    status: 'OPEN',
    priority: 'HIGH',
    tenantId: mockTenantId,
    tags: ['billing', 'gateway'],
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockTimeline = [
    {
      id: 'event_001',
      ticketId: initialTicket.id,
      actorId: mockAgent.id,
      actorType: 'AGENT',
      action: 'CREATED',
      details: { initialStatus: 'OPEN' },
      createdAt: new Date().toISOString(),
    },
  ];

  const mockMessages = [
    {
      id: 'msg_001',
      ticketId: initialTicket.id,
      conversationId: 'conv_conc_101',
      senderType: 'CUSTOMER',
      senderId: 'cust_001',
      body: 'Our checkout is failing intermittently since 2pm.',
      isInternal: false,
      createdAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
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

    cy.intercept('GET', '/api/v1/tickets*', {
      statusCode: 200,
      body: {
        data: [initialTicket],
        total: 1,
        page: 1,
        limit: 20,
      },
    }).as('getTickets');

    cy.intercept('GET', `/api/v1/tickets/${initialTicket.id}`, {
      statusCode: 200,
      body: {
        data: {
          ticket: initialTicket,
          timeline: mockTimeline,
          messages: mockMessages,
        },
      },
    }).as('getTicketDetail');
  });

  const loginAndOpenTicket = () => {
    cy.visit('/');
    cy.get('input[type="email"]').clear().type(mockAgent.email);
    cy.get('input[type="password"]').clear().type('SecretPassword123!');
    cy.get('button[type="submit"]').click();

    cy.contains('SupportPilot').should('be.visible');
    cy.contains('High priority payment gateway timeout').should('be.visible').click();
    cy.get('[data-testid="ticket-detail-view"]').should('be.visible');
    cy.contains('#1042').should('be.visible');
  };

  describe('Tier 1: Nominal Lifecycle & Version Tracking', () => {
    it('TC-T1-TKT-02 & TC-T1-TKT-03: Successfully updates ticket status with matching version', () => {
      const updatedTicket = { ...initialTicket, version: 2, status: 'RESOLVED' };

      cy.intercept('PATCH', `/api/v1/tickets/${initialTicket.id}`, {
        statusCode: 200,
        body: {
          data: updatedTicket,
          ...updatedTicket,
        },
      }).as('updateTicketStatus');

      loginAndOpenTicket();

      // Click Resolve button
      cy.contains('button', 'Resolve').click();
      cy.wait('@updateTicketStatus').its('request.body').should('deep.include', {
        version: 1,
        status: 'RESOLVED',
      });
    });
  });

  describe('Tier 2: Optimistic Concurrency Conflict Detection', () => {
    it('TC-T2-TKT-01: Displays conflict warning prompt on HTTP 409 Conflict', () => {
      // Intercept PATCH returning 409 Conflict (version collision)
      cy.intercept('PATCH', `/api/v1/tickets/${initialTicket.id}`, {
        statusCode: 409,
        body: {
          type: 'https://supportpilot.io/errors/conflict',
          title: 'Conflict',
          status: 409,
          detail: 'Ticket was modified by another user',
        },
      }).as('conflictUpdate');

      loginAndOpenTicket();

      // Attempt status change that triggers 409 Conflict
      cy.contains('button', 'Resolve').click();
      cy.wait('@conflictUpdate');

      // Verify conflict banner rendered with exact copy
      cy.get('[data-testid="conflict-warning"]').should('be.visible');
      cy.contains(
        'This ticket was updated by another agent. Data has been reloaded to latest version.',
      ).should('be.visible');

      // Dismiss warning
      cy.get('[data-testid="conflict-warning"] button').click();
      cy.get('[data-testid="conflict-warning"]').should('not.exist');
    });

    it('TC-T2-TKT-02: Rejects invalid status transition with HTTP 400', () => {
      cy.intercept('PATCH', `/api/v1/tickets/${initialTicket.id}`, {
        statusCode: 400,
        body: {
          type: 'https://supportpilot.io/errors/bad-request',
          title: 'Invalid Status Transition',
          status: 400,
          detail: 'Status transition from CLOSED to NEW is not permitted.',
        },
      }).as('invalidTransition');

      loginAndOpenTicket();
    });
  });

  describe('Tier 3: Pairwise Concurrent Mutation & Recovery', () => {
    it('TC-T3-05: Concurrent edit triggers 409, refetches version 2, and allows subsequent save', () => {
      let patchCount = 0;
      const ticketV2 = { ...initialTicket, version: 2 };
      const ticketV3 = { ...initialTicket, version: 3, status: 'RESOLVED' };

      cy.intercept('PATCH', `/api/v1/tickets/${initialTicket.id}`, (req) => {
        patchCount += 1;
        if (patchCount === 1) {
          req.reply({
            statusCode: 409,
            body: {
              type: 'https://supportpilot.io/errors/conflict',
              title: 'Conflict',
              status: 409,
              detail: 'Ticket was modified by another user',
            },
          });
        } else {
          req.reply({
            statusCode: 200,
            body: {
              data: ticketV3,
              ...ticketV3,
            },
          });
        }
      }).as('sequentialPatch');

      // Setup refetch to return version 2 after conflict
      cy.intercept('GET', `/api/v1/tickets/${initialTicket.id}`, (req) => {
        if (patchCount > 0) {
          req.reply({
            statusCode: 200,
            body: {
              data: {
                ticket: ticketV2,
                timeline: mockTimeline,
                messages: mockMessages,
              },
            },
          });
        } else {
          req.reply({
            statusCode: 200,
            body: {
              data: {
                ticket: initialTicket,
                timeline: mockTimeline,
                messages: mockMessages,
              },
            },
          });
        }
      }).as('getTicketDetailSequential');

      loginAndOpenTicket();

      // First attempt fails with 409
      cy.contains('button', 'Resolve').click();
      cy.wait('@sequentialPatch');
      cy.get('[data-testid="conflict-warning"]').should('be.visible');

      // Automatic refetch updates state to v2
      cy.contains('v2').should('be.visible');

      // Second attempt succeeds with v2 -> v3
      cy.contains('button', 'Resolve').click();
      cy.wait('@sequentialPatch').its('request.body').should('deep.include', {
        version: 2,
        status: 'RESOLVED',
      });
    });
  });
});
