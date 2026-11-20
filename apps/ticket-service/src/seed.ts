import { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { isDbConnected } from './lib/mongoose.js';
import { Tenant } from './models/tenant.model.js';
import { User } from './models/user.model.js';
import { Ticket } from './models/ticket.model.js';

export interface SeedResult {
  tenantsCount: number;
  usersCount: number;
  ticketsCount: number;
  rulesCount: number;
  featureFlagsCount: number;
  apiKeysCount: number;
}

const PASSWORD_HASH = bcrypt.hashSync('Password123!', 10);

export const SEED_DATA = {
  tenants: [
    {
      _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
      name: 'Acme Corporation',
      slug: 'acme-corp',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
      widgetKey: 'wk_acme_live_9921',
      settings: {
        brand: { color: '#4f46e5' },
        businessHours: [
          { day: 1, start: '09:00', end: '17:00' },
          { day: 2, start: '09:00', end: '17:00' },
          { day: 3, start: '09:00', end: '17:00' },
          { day: 4, start: '09:00', end: '17:00' },
          { day: 5, start: '09:00', end: '17:00' },
        ],
        timezone: 'UTC',
        sla: {
          LOW: { firstResponseMin: 480, resolveMin: 1440 },
          MEDIUM: { firstResponseMin: 240, resolveMin: 720 },
          HIGH: { firstResponseMin: 60, resolveMin: 240 },
          URGENT: { firstResponseMin: 15, resolveMin: 60 },
        },
        aiEnabled: true,
        aiThreshold: 0.55,
      },
    },
    {
      _id: new Types.ObjectId('507f1f77bcf86cd799439022'),
      name: 'Globex Logistics',
      slug: 'globex-logistics',
      plan: 'GROWTH',
      status: 'ACTIVE',
      widgetKey: 'wk_globex_live_8832',
      settings: {
        brand: { color: '#059669' },
        businessHours: [
          { day: 1, start: '08:00', end: '18:00' },
          { day: 2, start: '08:00', end: '18:00' },
          { day: 3, start: '08:00', end: '18:00' },
          { day: 4, start: '08:00', end: '18:00' },
          { day: 5, start: '08:00', end: '18:00' },
        ],
        timezone: 'America/New_York',
        sla: {
          LOW: { firstResponseMin: 480, resolveMin: 1440 },
          MEDIUM: { firstResponseMin: 240, resolveMin: 720 },
          HIGH: { firstResponseMin: 60, resolveMin: 240 },
          URGENT: { firstResponseMin: 15, resolveMin: 60 },
        },
        aiEnabled: true,
        aiThreshold: 0.6,
      },
    },
    {
      _id: new Types.ObjectId('507f1f77bcf86cd799439033'),
      name: 'Initech Financial',
      slug: 'initech',
      plan: 'STARTER',
      status: 'ACTIVE',
      widgetKey: 'wk_initech_live_7743',
      settings: {
        brand: { color: '#d97706' },
        businessHours: [
          { day: 1, start: '09:00', end: '17:00' },
          { day: 2, start: '09:00', end: '17:00' },
          { day: 3, start: '09:00', end: '17:00' },
          { day: 4, start: '09:00', end: '17:00' },
          { day: 5, start: '09:00', end: '17:00' },
        ],
        timezone: 'America/Chicago',
        sla: {
          LOW: { firstResponseMin: 720, resolveMin: 2880 },
          MEDIUM: { firstResponseMin: 480, resolveMin: 1440 },
          HIGH: { firstResponseMin: 120, resolveMin: 480 },
          URGENT: { firstResponseMin: 30, resolveMin: 120 },
        },
        aiEnabled: false,
        aiThreshold: 0.5,
      },
    },
  ],

  users: [
    {
      _id: new Types.ObjectId('507f191e810c19729de860aa'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
      email: 'owner@acme.com',
      name: 'Alice Owner',
      passwordHash: PASSWORD_HASH,
      role: 'OWNER',
      emailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860ab'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
      email: 'admin@acme.com',
      name: 'Bob Lead',
      passwordHash: PASSWORD_HASH,
      role: 'LEAD',
      emailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860ac'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
      email: 'agent1@acme.com',
      name: 'Charlie Agent',
      passwordHash: PASSWORD_HASH,
      role: 'AGENT',
      emailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860ad'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
      email: 'agent2@acme.com',
      name: 'Diana Support',
      passwordHash: PASSWORD_HASH,
      role: 'AGENT',
      emailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860ba'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439022'),
      email: 'owner@globex.com',
      name: 'Hank Scorpio',
      passwordHash: PASSWORD_HASH,
      role: 'OWNER',
      emailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860bb'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439022'),
      email: 'agent@globex.com',
      name: 'Gary Globex',
      passwordHash: PASSWORD_HASH,
      role: 'AGENT',
      emailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860ca'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439033'),
      email: 'owner@initech.com',
      name: 'Peter Gibbons',
      passwordHash: PASSWORD_HASH,
      role: 'OWNER',
      emailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860cb'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439033'),
      email: 'agent@initech.com',
      name: 'Milton Waddams',
      passwordHash: PASSWORD_HASH,
      role: 'AGENT',
      emailVerified: true,
    },
  ],
};

const SAMPLE_SUBJECTS = [
  { subject: 'Cannot access billing portal after card update', cat: 'billing', prio: 'HIGH' },
  { subject: 'Fatal 500 error when exporting monthly reports to CSV', cat: 'bug', prio: 'URGENT' },
  {
    subject: 'How do I invite secondary team members with view-only permissions?',
    cat: 'how-to',
    prio: 'LOW',
  },
  {
    subject: 'Account locked out after three failed mobile biometric logins',
    cat: 'account',
    prio: 'HIGH',
  },
  {
    subject: 'Requesting webhook payload support for custom metadata tags',
    cat: 'feature request',
    prio: 'MEDIUM',
  },
  {
    subject: 'Invoice duplicate charge received for subscription renewal',
    cat: 'billing',
    prio: 'URGENT',
  },
  {
    subject: 'Widget bubble does not appear in Safari Private Browsing',
    cat: 'bug',
    prio: 'MEDIUM',
  },
  {
    subject: 'Configuring custom SMTP mail server for outbound notifications',
    cat: 'how-to',
    prio: 'LOW',
  },
  {
    subject: 'SSO SAML authentication loop with Okta identity provider',
    cat: 'account',
    prio: 'URGENT',
  },
  {
    subject: 'Slack integration bot disconnected after workspace rename',
    cat: 'bug',
    prio: 'HIGH',
  },
];

export function generateSeedTickets(tenantId: Types.ObjectId, count: number = 50) {
  const tickets: any[] = [];
  const statuses = ['NEW', 'OPEN', 'PENDING_CUSTOMER', 'ON_HOLD', 'RESOLVED', 'CLOSED'] as const;

  for (let i = 1; i <= count; i++) {
    const template = SAMPLE_SUBJECTS[(i - 1) % SAMPLE_SUBJECTS.length]!;
    const status = statuses[(i - 1) % statuses.length]!;
    const priority = template.prio;
    const category = template.cat;
    const date = new Date(Date.now() - (count - i) * 3600 * 1000 * 4);

    tickets.push({
      _id: new Types.ObjectId(),
      tenantId,
      number: i,
      subject: `${template.subject} (#${1000 + i})`,
      description: `Customer encountered unexpected behavior while operating the portal. Requesting immediate investigation.\nDetails: System ref SP-${1000 + i}.`,
      status,
      priority,
      category,
      channel: i % 3 === 0 ? 'CHAT' : i % 2 === 0 ? 'EMAIL' : 'WEB',
      customer: {
        name: `Customer User ${i}`,
        email: `client${i}@example.com`,
      },
      tags: [category, priority.toLowerCase()],
      version: 1,
      createdAt: date,
      updatedAt: date,
    });
  }
  return tickets;
}

export async function runSeed(mode: string = 'memory'): Promise<SeedResult> {
  const acmeId = SEED_DATA.tenants[0]!._id;
  const acmeTickets = generateSeedTickets(acmeId, 50);

  const result: SeedResult = {
    tenantsCount: SEED_DATA.tenants.length,
    usersCount: SEED_DATA.users.length,
    ticketsCount: acmeTickets.length,
    rulesCount: 4,
    featureFlagsCount: 15,
    apiKeysCount: 3,
  };

  if (mode !== 'memory' && isDbConnected()) {
    await Tenant.deleteMany({});
    await Tenant.insertMany(SEED_DATA.tenants);

    await User.deleteMany({});
    await User.insertMany(SEED_DATA.users);

    await Ticket.deleteMany({});
    await Ticket.insertMany(acmeTickets);
  }

  return result;
}
