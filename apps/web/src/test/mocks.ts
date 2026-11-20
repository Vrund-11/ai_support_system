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
