import type { TicketDto, MessageDto, TicketEventDto, UserDto } from '@supportpilot/shared-types';

export const mockUser: UserDto = {
  id: 'user_123',
  email: 'agent@supportpilot.io',
  name: 'Alex Agent',
  role: 'AGENT',
  tenantId: 'tenant_123',
};

export const mockTicket: TicketDto = {
  id: 'ticket_abc',
  tenantId: 'tenant_123',
  number: 1001,
  subject: 'Cannot login to account',
  description: 'Customer says their 2FA is locked out',
  status: 'OPEN',
  priority: 'HIGH',
  customerId: 'cust_999',
  tags: ['auth', 'urgent'],
  version: 2,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const mockTicket2: TicketDto = {
  id: 'ticket_xyz',
  tenantId: 'tenant_123',
  number: 1002,
  subject: 'Billing inquiry',
  description: 'Invoice discrepancy for last month',
  status: 'PENDING_CUSTOMER',
  priority: 'LOW',
  customerId: 'cust_888',
  tags: ['billing'],
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const mockMessages: MessageDto[] = [
  {
    id: 'msg_1',
    tenantId: 'tenant_123',
    ticketId: 'ticket_abc',
    seq: 1,
    senderType: 'CUSTOMER',
    body: 'I cannot receive the 2FA SMS code.',
    isInternal: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'msg_2',
    tenantId: 'tenant_123',
    ticketId: 'ticket_abc',
    seq: 2,
    senderType: 'AGENT',
    body: 'Checking carrier logs now. Please verify phone number.',
    isInternal: true,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
];

export const mockTimeline: TicketEventDto[] = [
  {
    id: 'evt_1',
    tenantId: 'tenant_123',
    ticketId: 'ticket_abc',
    type: 'STATUS',
    actorId: 'user_123',
    payload: { from: 'NEW', to: 'OPEN' },
    createdAt: new Date(Date.now() - 3500000).toISOString(),
  },
  {
    id: 'evt_2',
    tenantId: 'tenant_123',
    ticketId: 'ticket_abc',
    type: 'PRIORITY',
    actorId: 'user_123',
    payload: { from: 'MEDIUM', to: 'HIGH' },
    createdAt: new Date(Date.now() - 3400000).toISOString(),
  },
];

export const mockCustomer = {
  id: 'cust_999',
  name: 'Alice Customer',
  email: 'alice@example.com',
  phone: '+1 555-0100',
  company: 'Acme Corp',
  ticketCount: 3,
  createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
};

export const mockTeamMember = {
  id: 'user_123',
  name: 'Alex Agent',
  email: 'agent@supportpilot.io',
  role: 'AGENT' as const,
  status: 'ACTIVE' as const,
  createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
};

export const mockRule = {
  id: 'rule_1',
  tenantId: 'tenant_123',
  name: 'Auto-tag Urgent Tickets',
  description: 'Add urgent tag when priority is HIGH',
  event: 'TICKET_CREATED' as const,
  conditionLogic: 'AND' as const,
  conditions: [
    {
      field: 'priority' as const,
      operator: 'EQUALS' as const,
      value: 'HIGH',
    },
  ],
  actions: [
    {
      type: 'ADD_TAG' as const,
      target: 'urgent',
    },
  ],
  enabled: true,
  order: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const mockNotification = {
  id: 'notif_1',
  title: 'New ticket assigned',
  message: 'Ticket #1001 assigned to you',
  type: 'TICKET_ASSIGNED' as const,
  read: false,
  ticketId: 'ticket_abc',
  createdAt: new Date().toISOString(),
};
