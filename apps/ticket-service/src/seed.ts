import { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { isDbConnected } from './lib/mongoose.js';
import { Tenant } from './models/tenant.model.js';
import { User } from './models/user.model.js';
import { Ticket } from './models/ticket.model.js';
import { Customer } from './models/customer.model.js';
import { Message } from './models/message.model.js';
import { TicketEvent } from './models/ticket-event.model.js';
import { FeatureFlagModel } from './models/feature-flag.model.js';
import { RuleModel } from './models/rule.model.js';
import { ApiKeyModel } from './models/api-key.model.js';
import { WebhookSubscriptionModel } from './models/webhook.model.js';
import { AuditLogModel } from './models/audit-log.model.js';
import { Counter } from './models/counter.model.js';

export interface SeedResult {
  tenantsCount: number;
  usersCount: number;
  ticketsCount: number;
  messagesCount: number;
  ticketEventsCount: number;
  rulesCount: number;
  featureFlagsCount: number;
  apiKeysCount: number;
  webhooksCount: number;
  auditLogsCount: number;
  countersCount: number;
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
      stripeCustomerId: 'cus_acme_enterprise_01',
      stripeSubscriptionId: 'sub_acme_ent_annual_01',
      quotas: {
        maxUsers: 50,
        maxTicketsPerMonth: 50000,
        maxAiTokensPerMonth: 50000000,
        vectorLimitGb: 20,
      },
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
      plan: 'PRO',
      status: 'ACTIVE',
      widgetKey: 'wk_globex_live_8832',
      stripeCustomerId: 'cus_globex_pro_02',
      stripeSubscriptionId: 'sub_globex_pro_monthly_02',
      quotas: {
        maxUsers: 25,
        maxTicketsPerMonth: 20000,
        maxAiTokensPerMonth: 20000000,
        vectorLimitGb: 10,
      },
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
      plan: 'FREE',
      status: 'ACTIVE',
      widgetKey: 'wk_initech_live_7743',
      quotas: {
        maxUsers: 5,
        maxTicketsPerMonth: 1000,
        maxAiTokensPerMonth: 1000000,
        vectorLimitGb: 1,
      },
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
    {
      _id: new Types.ObjectId('507f1f77bcf86cd799439044'),
      name: 'Cyberdyne Systems',
      slug: 'cyberdyne',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
      widgetKey: 'wk_cyberdyne_live_6654',
      stripeCustomerId: 'cus_cyberdyne_03',
      stripeSubscriptionId: 'sub_cyberdyne_annual_03',
      quotas: {
        maxUsers: 100,
        maxTicketsPerMonth: 100000,
        maxAiTokensPerMonth: 100000000,
        vectorLimitGb: 50,
      },
      settings: {
        brand: { color: '#dc2626' },
        businessHours: [
          { day: 1, start: '00:00', end: '23:59' },
          { day: 2, start: '00:00', end: '23:59' },
          { day: 3, start: '00:00', end: '23:59' },
          { day: 4, start: '00:00', end: '23:59' },
          { day: 5, start: '00:00', end: '23:59' },
          { day: 6, start: '00:00', end: '23:59' },
          { day: 0, start: '00:00', end: '23:59' },
        ],
        timezone: 'America/Los_Angeles',
        sla: {
          LOW: { firstResponseMin: 120, resolveMin: 480 },
          MEDIUM: { firstResponseMin: 60, resolveMin: 240 },
          HIGH: { firstResponseMin: 30, resolveMin: 120 },
          URGENT: { firstResponseMin: 5, resolveMin: 30 },
        },
        aiEnabled: true,
        aiThreshold: 0.7,
      },
    },
    {
      _id: new Types.ObjectId('507f1f77bcf86cd799439055'),
      name: 'Wayne Enterprises',
      slug: 'wayne-enterprises',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
      widgetKey: 'wk_wayne_live_5565',
      stripeCustomerId: 'cus_wayne_04',
      stripeSubscriptionId: 'sub_wayne_ent_04',
      quotas: {
        maxUsers: 40,
        maxTicketsPerMonth: 30000,
        maxAiTokensPerMonth: 30000000,
        vectorLimitGb: 15,
      },
      settings: {
        brand: { color: '#0f172a' },
        businessHours: [
          { day: 1, start: '08:00', end: '20:00' },
          { day: 2, start: '08:00', end: '20:00' },
          { day: 3, start: '08:00', end: '20:00' },
          { day: 4, start: '08:00', end: '20:00' },
          { day: 5, start: '08:00', end: '20:00' },
        ],
        timezone: 'America/New_York',
        sla: {
          LOW: { firstResponseMin: 240, resolveMin: 720 },
          MEDIUM: { firstResponseMin: 120, resolveMin: 360 },
          HIGH: { firstResponseMin: 45, resolveMin: 180 },
          URGENT: { firstResponseMin: 10, resolveMin: 45 },
        },
        aiEnabled: true,
        aiThreshold: 0.65,
      },
    },
    {
      _id: new Types.ObjectId('507f1f77bcf86cd799439066'),
      name: 'Pied Piper Cloud',
      slug: 'pied-piper',
      plan: 'PRO',
      status: 'ACTIVE',
      widgetKey: 'wk_piedpiper_live_4476',
      stripeCustomerId: 'cus_piedpiper_05',
      stripeSubscriptionId: 'sub_piedpiper_pro_05',
      quotas: {
        maxUsers: 20,
        maxTicketsPerMonth: 15000,
        maxAiTokensPerMonth: 15000000,
        vectorLimitGb: 8,
      },
      settings: {
        brand: { color: '#10b981' },
        businessHours: [
          { day: 1, start: '09:00', end: '18:00' },
          { day: 2, start: '09:00', end: '18:00' },
          { day: 3, start: '09:00', end: '18:00' },
          { day: 4, start: '09:00', end: '18:00' },
          { day: 5, start: '09:00', end: '18:00' },
        ],
        timezone: 'America/Los_Angeles',
        sla: {
          LOW: { firstResponseMin: 360, resolveMin: 1080 },
          MEDIUM: { firstResponseMin: 180, resolveMin: 540 },
          HIGH: { firstResponseMin: 60, resolveMin: 240 },
          URGENT: { firstResponseMin: 15, resolveMin: 60 },
        },
        aiEnabled: true,
        aiThreshold: 0.58,
      },
    },
  ],

  users: [
    // Acme Corporation (6 users)
    {
      _id: new Types.ObjectId('507f191e810c19729de860aa'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
      email: 'owner@acme.com',
      name: 'Alice Owner',
      passwordHash: PASSWORD_HASH,
      role: 'OWNER',
      status: 'ACTIVE',
      isEmailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860ab'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
      email: 'admin@acme.com',
      name: 'Bob Lead',
      passwordHash: PASSWORD_HASH,
      role: 'LEAD',
      status: 'ACTIVE',
      isEmailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860ac'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
      email: 'agent1@acme.com',
      name: 'Charlie Agent',
      passwordHash: PASSWORD_HASH,
      role: 'AGENT',
      status: 'ACTIVE',
      isEmailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860ad'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
      email: 'agent2@acme.com',
      name: 'Diana Support',
      passwordHash: PASSWORD_HASH,
      role: 'AGENT',
      status: 'ACTIVE',
      isEmailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860ae'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
      email: 'agent3@acme.com',
      name: 'Evan Triage',
      passwordHash: PASSWORD_HASH,
      role: 'AGENT',
      status: 'ACTIVE',
      isEmailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860af'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
      email: 'agent4@acme.com',
      name: 'Fiona Resolver',
      passwordHash: PASSWORD_HASH,
      role: 'AGENT',
      status: 'ACTIVE',
      isEmailVerified: true,
    },

    // Globex Logistics (4 users)
    {
      _id: new Types.ObjectId('507f191e810c19729de860ba'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439022'),
      email: 'owner@globex.com',
      name: 'Hank Scorpio',
      passwordHash: PASSWORD_HASH,
      role: 'OWNER',
      status: 'ACTIVE',
      isEmailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860bb'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439022'),
      email: 'agent@globex.com',
      name: 'Gary Globex',
      passwordHash: PASSWORD_HASH,
      role: 'AGENT',
      status: 'ACTIVE',
      isEmailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860bc'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439022'),
      email: 'lisa@globex.com',
      name: 'Lisa Freight',
      passwordHash: PASSWORD_HASH,
      role: 'AGENT',
      status: 'ACTIVE',
      isEmailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860bd'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439022'),
      email: 'marco@globex.com',
      name: 'Marco Logistics Lead',
      passwordHash: PASSWORD_HASH,
      role: 'LEAD',
      status: 'ACTIVE',
      isEmailVerified: true,
    },

    // Initech Financial (5 users)
    {
      _id: new Types.ObjectId('507f191e810c19729de860ca'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439033'),
      email: 'owner@initech.com',
      name: 'Peter Gibbons',
      passwordHash: PASSWORD_HASH,
      role: 'OWNER',
      isEmailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860cb'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439033'),
      email: 'agent@initech.com',
      name: 'Milton Waddams',
      passwordHash: PASSWORD_HASH,
      role: 'AGENT',
      isEmailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860cc'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439033'),
      email: 'admin@initech.com',
      name: 'Bill Lumbergh',
      passwordHash: PASSWORD_HASH,
      role: 'LEAD',
      isEmailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860cd'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439033'),
      email: 'michael@initech.com',
      name: 'Michael Bolton',
      passwordHash: PASSWORD_HASH,
      role: 'AGENT',
      isEmailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860ce'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439033'),
      email: 'samir@initech.com',
      name: 'Samir Nagheenanajar',
      passwordHash: PASSWORD_HASH,
      role: 'AGENT',
      isEmailVerified: true,
    },

    // Cyberdyne Systems (3 users)
    {
      _id: new Types.ObjectId('507f191e810c19729de860da'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439044'),
      email: 'owner@cyberdyne.com',
      name: 'Miles Dyson',
      passwordHash: PASSWORD_HASH,
      role: 'OWNER',
      isEmailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860db'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439044'),
      email: 'lead@cyberdyne.com',
      name: 'John Connor',
      passwordHash: PASSWORD_HASH,
      role: 'LEAD',
      isEmailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860dc'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439044'),
      email: 'agent@cyberdyne.com',
      name: 'Cybernetic T-800',
      passwordHash: PASSWORD_HASH,
      role: 'AGENT',
      isEmailVerified: true,
    },

    // Wayne Enterprises (3 users)
    {
      _id: new Types.ObjectId('507f191e810c19729de860ea'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439055'),
      email: 'owner@wayne.com',
      name: 'Bruce Wayne',
      passwordHash: PASSWORD_HASH,
      role: 'OWNER',
      isEmailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860eb'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439055'),
      email: 'lead@wayne.com',
      name: 'Lucius Fox',
      passwordHash: PASSWORD_HASH,
      role: 'LEAD',
      isEmailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860ec'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439055'),
      email: 'agent@wayne.com',
      name: 'Alfred Pennyworth',
      passwordHash: PASSWORD_HASH,
      role: 'AGENT',
      isEmailVerified: true,
    },

    // Pied Piper (4 users)
    {
      _id: new Types.ObjectId('507f191e810c19729de860fa'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439066'),
      email: 'owner@piedpiper.com',
      name: 'Richard Hendricks',
      passwordHash: PASSWORD_HASH,
      role: 'OWNER',
      isEmailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860fb'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439066'),
      email: 'lead@piedpiper.com',
      name: 'Dinesh Chugtai',
      passwordHash: PASSWORD_HASH,
      role: 'LEAD',
      isEmailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860fc'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439066'),
      email: 'gilfoyle@piedpiper.com',
      name: 'Bertram Gilfoyle',
      passwordHash: PASSWORD_HASH,
      role: 'AGENT',
      isEmailVerified: true,
    },
    {
      _id: new Types.ObjectId('507f191e810c19729de860fd'),
      tenantId: new Types.ObjectId('507f1f77bcf86cd799439066'),
      email: 'jared@piedpiper.com',
      name: 'Jared Dunn',
      passwordHash: PASSWORD_HASH,
      role: 'AGENT',
      isEmailVerified: true,
    },
  ],
};

export const SEED_CUSTOMERS = [
  {
    _id: new Types.ObjectId('507f1f77bcf86cd799439101'),
    tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
    email: 'sarah.connor@cyberdyne.com',
    name: 'Sarah Connor',
    visitorIds: ['vis_001'],
  },
  {
    _id: new Types.ObjectId('507f1f77bcf86cd799439102'),
    tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
    email: 'john.wick@continental.hotel',
    name: 'John Wick',
    visitorIds: ['vis_002'],
  },
  {
    _id: new Types.ObjectId('507f1f77bcf86cd799439103'),
    tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
    email: 'ellen.ripley@weyland-yutani.com',
    name: 'Ellen Ripley',
    visitorIds: ['vis_003'],
  },
  {
    _id: new Types.ObjectId('507f1f77bcf86cd799439104'),
    tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
    email: 'tony.stark@starkindustries.com',
    name: 'Tony Stark',
    visitorIds: ['vis_004'],
  },
  {
    _id: new Types.ObjectId('507f1f77bcf86cd799439105'),
    tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
    email: 'bruce.wayne@wayneenterprises.com',
    name: 'Bruce Wayne',
    visitorIds: ['vis_005'],
  },
  {
    _id: new Types.ObjectId('507f1f77bcf86cd799439106'),
    tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
    email: 'neo.anderson@metacortex.net',
    name: 'Thomas Anderson',
    visitorIds: ['vis_006'],
  },
  {
    _id: new Types.ObjectId('507f1f77bcf86cd799439107'),
    tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
    email: 'trinity@nebuchadnezzar.ship',
    name: 'Trinity Matrix',
    visitorIds: ['vis_007'],
  },
  {
    _id: new Types.ObjectId('507f1f77bcf86cd799439108'),
    tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
    email: 'marty.mcfly@hillvalley.edu',
    name: 'Marty McFly',
    visitorIds: ['vis_008'],
  },
  {
    _id: new Types.ObjectId('507f1f77bcf86cd799439109'),
    tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
    email: 'emmett.brown@delorean.tech',
    name: 'Emmett Brown',
    visitorIds: ['vis_009'],
  },
  {
    _id: new Types.ObjectId('507f1f77bcf86cd799439110'),
    tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
    email: 'walter.white@albuquerque.chem',
    name: 'Walter White',
    visitorIds: ['vis_010'],
  },
  {
    _id: new Types.ObjectId('507f1f77bcf86cd799439111'),
    tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
    email: 'jesse.pinkman@vamonos.pest',
    name: 'Jesse Pinkman',
    visitorIds: ['vis_011'],
  },
  {
    _id: new Types.ObjectId('507f1f77bcf86cd799439112'),
    tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
    email: 'arthur.dent@milliways.galaxy',
    name: 'Arthur Dent',
    visitorIds: ['vis_012'],
  },
  {
    _id: new Types.ObjectId('507f1f77bcf86cd799439113'),
    tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
    email: 'luke.skywalker@rebelalliance.org',
    name: 'Luke Skywalker',
    visitorIds: ['vis_013'],
  },
  {
    _id: new Types.ObjectId('507f1f77bcf86cd799439114'),
    tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
    email: 'leia.organa@senate.alderaan',
    name: 'Leia Organa',
    visitorIds: ['vis_014'],
  },
  {
    _id: new Types.ObjectId('507f1f77bcf86cd799439115'),
    tenantId: new Types.ObjectId('507f1f77bcf86cd799439011'),
    email: 'han.solo@millenniumfalcon.cargo',
    name: 'Han Solo',
    visitorIds: ['vis_015'],
  },
];

const RICH_SUBJECT_TEMPLATES = [
  // Billing (cat: 'billing')
  {
    subject: 'Cannot access billing portal after corporate card update',
    cat: 'billing',
    prio: 'HIGH',
  },
  {
    subject: 'Invoice duplicate charge received for monthly subscription renewal',
    cat: 'billing',
    prio: 'URGENT',
  },
  {
    subject: 'Need updated VAT identification number on previous fiscal quarter invoice',
    cat: 'billing',
    prio: 'MEDIUM',
  },
  {
    subject: 'Requesting refund for unused enterprise agent seats after team downsizing',
    cat: 'billing',
    prio: 'MEDIUM',
  },
  {
    subject: 'ACH direct debit wire transfer receipt confirmation pending',
    cat: 'billing',
    prio: 'LOW',
  },
  {
    subject: 'Credit card expiration warning received despite valid card on file',
    cat: 'billing',
    prio: 'HIGH',
  },

  // Bug (cat: 'bug')
  {
    subject: 'Fatal 500 internal server error when exporting monthly analytics to CSV',
    cat: 'bug',
    prio: 'URGENT',
  },
  {
    subject: 'Widget bubble launcher does not appear on Safari iOS in private browsing',
    cat: 'bug',
    prio: 'MEDIUM',
  },
  {
    subject: 'Slack integration webhook disconnected after workspace domain migration',
    cat: 'bug',
    prio: 'HIGH',
  },
  {
    subject: 'Markdown code snippets render with misaligned indentation in chat transcript',
    cat: 'bug',
    prio: 'LOW',
  },
  {
    subject: 'Concurrent ticket status updates trigger 409 conflict error on stale page',
    cat: 'bug',
    prio: 'HIGH',
  },
  {
    subject: 'Customer avatar image returns 404 broken link after profile photo upload',
    cat: 'bug',
    prio: 'LOW',
  },

  // How-to (cat: 'how-to')
  {
    subject: 'How do I invite secondary team members with view-only read permissions?',
    cat: 'how-to',
    prio: 'LOW',
  },
  {
    subject: 'Configuring custom SMTP mail server credentials for outbound notifications',
    cat: 'how-to',
    prio: 'LOW',
  },
  {
    subject: 'Best practice guide for chunk size and overlap when ingesting PDF knowledge bases',
    cat: 'how-to',
    prio: 'LOW',
  },
  {
    subject: 'Steps to set up automated SLA breach warnings in notification channels',
    cat: 'how-to',
    prio: 'MEDIUM',
  },
  {
    subject: 'Connecting custom REST webhook listeners to receive real-time ticket events',
    cat: 'how-to',
    prio: 'LOW',
  },
  {
    subject: 'Customizing brand colors and launcher logo on the embeddable chat widget',
    cat: 'how-to',
    prio: 'LOW',
  },

  // Account & Security (cat: 'account')
  {
    subject: 'Account locked out after three failed mobile biometric FaceID attempts',
    cat: 'account',
    prio: 'HIGH',
  },
  {
    subject: 'SSO SAML authentication loop with Okta identity provider redirect',
    cat: 'account',
    prio: 'URGENT',
  },
  {
    subject: 'Require MFA TOTP reset for lead engineer after device replacement',
    cat: 'account',
    prio: 'HIGH',
  },
  {
    subject: 'Role privilege elevation requested from AGENT to LEAD for supervisor',
    cat: 'account',
    prio: 'MEDIUM',
  },
  {
    subject: 'Session timeout occurs prematurely during active ticket composition',
    cat: 'account',
    prio: 'MEDIUM',
  },
  {
    subject: 'Security compliance inquiry regarding SOC2 Type II audit report availability',
    cat: 'account',
    prio: 'LOW',
  },

  // Feature request (cat: 'feature request')
  {
    subject: 'Requesting webhook payload support for custom tenant metadata tags',
    cat: 'feature request',
    prio: 'MEDIUM',
  },
  {
    subject: 'Dark mode theme toggle support for embedded customer chat widget',
    cat: 'feature request',
    prio: 'LOW',
  },
  {
    subject: 'Automated CSAT satisfaction rating survey upon ticket resolution',
    cat: 'feature request',
    prio: 'MEDIUM',
  },
  {
    subject: 'Native Jira bidirectional issue synchronization integration',
    cat: 'feature request',
    prio: 'HIGH',
  },
  {
    subject: 'Support for multiple knowledge base document versions with rollback',
    cat: 'feature request',
    prio: 'MEDIUM',
  },
  {
    subject: 'Bulk ticket macro actions to reply, tag, and close tickets simultaneously',
    cat: 'feature request',
    prio: 'HIGH',
  },

  // Performance & Outage (cat: 'outage')
  {
    subject: 'Elevated latency observed on GraphQL ticket search during peak hours',
    cat: 'performance',
    prio: 'HIGH',
  },
  {
    subject: 'Database connection pool saturation leading to sporadic 504 gateway timeouts',
    cat: 'outage',
    prio: 'URGENT',
  },
  {
    subject: 'Real-time WebSocket disconnects affecting live chat queue presence indicators',
    cat: 'outage',
    prio: 'URGENT',
  },
  {
    subject: 'Redis cache eviction spike causing sudden degradation in semantic query speed',
    cat: 'performance',
    prio: 'MEDIUM',
  },
];

export function generateSeedTickets(
  tenantId: Types.ObjectId,
  count: number = 50,
  tenantUsers: any[] = [],
) {
  const tickets: any[] = [];
  const _statuses = ['NEW', 'OPEN', 'PENDING_CUSTOMER', 'ON_HOLD', 'RESOLVED', 'CLOSED'] as const;

  // Filter available agents for this tenant
  const agents = tenantUsers.filter(
    (u) => u.tenantId.equals(tenantId) && (u.role === 'AGENT' || u.role === 'LEAD'),
  );

  const nowMs = Date.now();
  // Spread tickets across 60 days
  const spanMs = 60 * 24 * 3600 * 1000;

  for (let i = 1; i <= count; i++) {
    const template = RICH_SUBJECT_TEMPLATES[(i - 1) % RICH_SUBJECT_TEMPLATES.length]!;

    // Distribute statuses realistically: 10% NEW, 30% OPEN, 15% PENDING, 5% ON_HOLD, 30% RESOLVED, 10% CLOSED
    let status: (typeof _statuses)[number];
    const statusRand = (i * 17) % 100;
    if (statusRand < 10) status = 'NEW';
    else if (statusRand < 40) status = 'OPEN';
    else if (statusRand < 55) status = 'PENDING_CUSTOMER';
    else if (statusRand < 60) status = 'ON_HOLD';
    else if (statusRand < 90) status = 'RESOLVED';
    else status = 'CLOSED';

    const priority = template.prio as any;
    const category = template.cat;

    // Distribute dates smoothly across the past 60 days up to today
    const progress = i / count;
    const ticketTime = new Date(nowMs - spanMs * (1 - progress) + (i % 8) * 3600 * 1000);

    const customer = SEED_CUSTOMERS[(i - 1) % SEED_CUSTOMERS.length]!;
    const assignee =
      status !== 'NEW' && agents.length > 0 ? agents[(i - 1) % agents.length] : undefined;

    // SLA calculations
    const firstResponseMin =
      priority === 'URGENT' ? 15 : priority === 'HIGH' ? 60 : priority === 'MEDIUM' ? 240 : 480;
    const resolveMin =
      priority === 'URGENT' ? 60 : priority === 'HIGH' ? 240 : priority === 'MEDIUM' ? 720 : 1440;

    const firstResponseDue = new Date(ticketTime.getTime() + firstResponseMin * 60 * 1000);
    const resolveDue = new Date(ticketTime.getTime() + resolveMin * 60 * 1000);

    const isBreached = i % 14 === 0; // ~7% realistic breach rate
    const actualResponseMin = isBreached ? firstResponseMin * 1.8 : firstResponseMin * 0.45;
    const actualResolveMin = isBreached ? resolveMin * 1.5 : resolveMin * 0.6;

    const firstRespondedAt =
      status !== 'NEW' ? new Date(ticketTime.getTime() + actualResponseMin * 60 * 1000) : undefined;
    const resolvedAt =
      status === 'RESOLVED' || status === 'CLOSED'
        ? new Date(ticketTime.getTime() + actualResolveMin * 60 * 1000)
        : undefined;

    const channel = i % 4 === 0 ? 'CHAT' : i % 3 === 0 ? 'EMAIL' : 'WEB';
    const conversationId = channel === 'CHAT' ? new Types.ObjectId() : undefined;

    tickets.push({
      _id: new Types.ObjectId(),
      tenantId,
      customerId: customer._id,
      assigneeId: assignee?._id,
      conversationId,
      number: i,
      subject: `${template.subject} (#${1000 + i})`,
      description: `Customer encountered unexpected behavior while operating the portal.\nDetails: System ref SP-${1000 + i}.\nCustomer email: ${customer.email}.\nExpected behavior is documented in knowledge base.`,
      status,
      priority,
      category,
      channel,
      tags: [
        category,
        priority.toLowerCase(),
        channel.toLowerCase(),
        isBreached ? 'sla-breach' : 'sla-met',
      ],
      version: 1,
      sla: {
        firstResponseDue,
        resolveDue,
        firstRespondedAt,
        resolvedAt,
        breached: isBreached,
      },
      createdAt: ticketTime,
      updatedAt: resolvedAt || firstRespondedAt || ticketTime,
    });
  }
  return tickets;
}

export function generateSeedMessagesAndEvents(
  tickets: any[],
  tenantId: Types.ObjectId,
  tenantUsers: any[],
) {
  const messages: any[] = [];
  const events: any[] = [];

  const agents = tenantUsers.filter(
    (u) => u.tenantId.equals(tenantId) && (u.role === 'AGENT' || u.role === 'LEAD'),
  );
  const fallbackAgent = agents[0] || tenantUsers[0];

  for (const t of tickets) {
    const tDate = new Date(t.createdAt);

    // Initial message from customer
    messages.push({
      _id: new Types.ObjectId(),
      tenantId,
      ticketId: t._id,
      conversationId: t.conversationId,
      seq: 1,
      senderType: 'CUSTOMER',
      body: `Hello Support Team,\n\nI am contacting you regarding: "${t.subject}".\n\n${t.description}`,
      citations: [],
      attachments: [],
      isInternal: false,
      readBy: t.assigneeId ? [t.assigneeId] : [],
      createdAt: tDate,
      updatedAt: tDate,
    });

    events.push({
      _id: new Types.ObjectId(),
      tenantId,
      ticketId: t._id,
      type: 'STATUS',
      from: undefined,
      to: 'NEW',
      at: tDate,
      createdAt: tDate,
      updatedAt: tDate,
    });

    // AI copilot response for tickets
    if (t.number % 2 === 0) {
      const aiDate = new Date(tDate.getTime() + 2 * 60 * 1000);
      messages.push({
        _id: new Types.ObjectId(),
        tenantId,
        ticketId: t._id,
        conversationId: t.conversationId,
        seq: 2,
        senderType: 'AI',
        body: `SupportPilot Copilot Suggestion: Based on our Knowledge Base documentation regarding "${t.category}", please verify your account configuration under Organization Settings. If the issue persists, our support team will investigate immediately.`,
        citations: [
          {
            chunkId: 'doc_auth_security_0',
            docId: 'doc_auth_security',
            title: 'Knowledge Base: System Guides',
          },
        ],
        attachments: [],
        isInternal: false,
        readBy: [],
        createdAt: aiDate,
        updatedAt: aiDate,
      });

      events.push({
        _id: new Types.ObjectId(),
        tenantId,
        ticketId: t._id,
        type: 'MESSAGE',
        from: undefined,
        to: 'AI Copilot response generated',
        at: aiDate,
        createdAt: aiDate,
        updatedAt: aiDate,
      });
    }

    // Agent response for non-new tickets
    if (t.status !== 'NEW') {
      const agentDate = t.sla.firstRespondedAt || new Date(tDate.getTime() + 20 * 60 * 1000);
      const agent = agents.find((a) => a._id.equals(t.assigneeId)) || fallbackAgent;

      events.push({
        _id: new Types.ObjectId(),
        tenantId,
        ticketId: t._id,
        actorId: agent._id,
        type: 'ASSIGN',
        from: undefined,
        to: agent.name,
        at: agentDate,
        createdAt: agentDate,
        updatedAt: agentDate,
      });

      events.push({
        _id: new Types.ObjectId(),
        tenantId,
        ticketId: t._id,
        actorId: agent._id,
        type: 'STATUS',
        from: 'NEW',
        to: 'OPEN',
        at: agentDate,
        createdAt: agentDate,
        updatedAt: agentDate,
      });

      messages.push({
        _id: new Types.ObjectId(),
        tenantId,
        ticketId: t._id,
        conversationId: t.conversationId,
        seq: 3,
        senderType: 'AGENT',
        senderId: agent._id,
        body: `Hi! Thanks for contacting us. I've taken ownership of ticket #${t.number}. I am checking our system metrics and backend logs for your account. I will follow up with complete resolution details.`,
        citations: [],
        attachments: [],
        isInternal: false,
        readBy: [agent._id],
        createdAt: agentDate,
        updatedAt: agentDate,
      });

      // Internal note
      const noteDate = new Date(agentDate.getTime() + 15 * 60 * 1000);
      messages.push({
        _id: new Types.ObjectId(),
        tenantId,
        ticketId: t._id,
        conversationId: t.conversationId,
        seq: 4,
        senderType: 'AGENT',
        senderId: agent._id,
        body: `Internal Note: Investigated database connection pool and trace spans. Status confirmed nominal. Awaiting customer confirmation.`,
        citations: [],
        attachments: [],
        isInternal: true,
        readBy: [agent._id],
        createdAt: noteDate,
        updatedAt: noteDate,
      });

      events.push({
        _id: new Types.ObjectId(),
        tenantId,
        ticketId: t._id,
        actorId: agent._id,
        type: 'NOTE',
        from: undefined,
        to: 'Internal investigation note added',
        at: noteDate,
        createdAt: noteDate,
        updatedAt: noteDate,
      });

      if (t.status === 'RESOLVED' || t.status === 'CLOSED') {
        const resolveDate = t.sla.resolvedAt || new Date(agentDate.getTime() + 60 * 60 * 1000);
        events.push({
          _id: new Types.ObjectId(),
          tenantId,
          ticketId: t._id,
          actorId: agent._id,
          type: 'STATUS',
          from: 'OPEN',
          to: t.status,
          at: resolveDate,
          createdAt: resolveDate,
          updatedAt: resolveDate,
        });
      }
    }
  }

  return { messages, events };
}

export function generateFeatureFlags(tenants: any[]) {
  const flags: any[] = [];
  const definitions = [
    {
      key: 'ai_copilot',
      name: 'AI Copilot Assist',
      description: 'Enable RAG reply suggestions and thread summarization',
    },
    {
      key: 'sla_automation',
      name: 'SLA Engine Automation',
      description: 'Automated 75% warning and 100% breach notifications',
    },
    {
      key: 'realtime_chat',
      name: 'Realtime Chat & Presence',
      description: 'Socket.IO live chat widget and online indicators',
    },
    {
      key: 'biometrics_auth',
      name: 'Biometrics Mobile Auth',
      description: 'FaceID / TouchID biometric login in mobile app',
    },
    {
      key: 'auto_assignment',
      name: 'Smart Ticket Assignment',
      description: 'Rule-based automatic ticket routing',
    },
  ];

  for (const t of tenants) {
    for (const d of definitions) {
      flags.push({
        _id: new Types.ObjectId(),
        tenantId: t._id,
        key: d.key,
        name: d.name,
        description: d.description,
        enabled: t.slug === 'initech' && d.key === 'ai_copilot' ? false : true,
      });
    }
  }
  return flags;
}

export function generateRules(tenants: any[], users: any[]) {
  const rules: any[] = [];

  for (const t of tenants) {
    const lead =
      users.find((u) => u.tenantId.equals(t._id) && u.role === 'LEAD') ||
      users.find((u) => u.tenantId.equals(t._id));
    const leadId = lead ? lead._id.toString() : '507f191e810c19729de860ab';

    rules.push(
      {
        _id: new Types.ObjectId(),
        tenantId: t._id,
        name: 'Urgent Outage Escalation',
        description:
          'Automatically assign urgent bug tickets to Lead Engineer and tag as p0-outage',
        event: 'TICKET_CREATED',
        conditions: [{ field: 'priority', operator: 'EQUALS', value: 'URGENT' }],
        conditionLogic: 'AND',
        actions: [
          { type: 'ASSIGN', target: leadId },
          { type: 'ADD_TAG', target: 'p0-outage' },
        ],
        enabled: true,
        order: 1,
      },
      {
        _id: new Types.ObjectId(),
        tenantId: t._id,
        name: 'Auto-Tag Billing Inquiries',
        description: 'Route and tag invoices and billing questions with high priority',
        event: 'TICKET_CREATED',
        conditions: [{ field: 'keyword', operator: 'CONTAINS', value: 'billing' }],
        conditionLogic: 'AND',
        actions: [
          { type: 'ADD_TAG', target: 'billing-team' },
          { type: 'SET_PRIORITY', target: 'HIGH' },
        ],
        enabled: true,
        order: 2,
      },
      {
        _id: new Types.ObjectId(),
        tenantId: t._id,
        name: 'Chat Channel VIP Route',
        description: 'Mark live chat widget conversations with chat-widget tag',
        event: 'TICKET_CREATED',
        conditions: [{ field: 'channel', operator: 'EQUALS', value: 'CHAT' }],
        conditionLogic: 'AND',
        actions: [{ type: 'ADD_TAG', target: 'live-chat' }],
        enabled: true,
        order: 3,
      },
      {
        _id: new Types.ObjectId(),
        tenantId: t._id,
        name: 'SLA Escalation Notification',
        description: 'Trigger notification when tickets reach critical priority',
        event: 'TICKET_UPDATED',
        conditions: [{ field: 'priority', operator: 'EQUALS', value: 'URGENT' }],
        conditionLogic: 'AND',
        actions: [{ type: 'ESCALATE', target: 'lead-team' }],
        enabled: true,
        order: 4,
      },
    );
  }
  return rules;
}

export function generateApiKeys(tenants: any[]) {
  const keys: any[] = [];
  for (const t of tenants) {
    const rawProdKey = `sp_live_${t.slug}_${crypto.randomBytes(8).toString('hex')}`;
    const prodPrefix = rawProdKey.substring(0, 15) + '...';
    const prodHash = crypto.createHash('sha256').update(rawProdKey).digest('hex');

    keys.push({
      _id: new Types.ObjectId(),
      tenantId: t._id,
      name: `${t.name} Production API Key`,
      keyHash: prodHash,
      prefix: prodPrefix,
      scopes: ['tickets:read', 'tickets:write', 'kb:read', 'analytics:read'],
      lastUsedAt: new Date(Date.now() - 3600 * 1000 * 2),
      createdAt: new Date(Date.now() - 3600 * 1000 * 24 * 7),
    });

    const rawRoKey = `sp_ro_${t.slug}_${crypto.randomBytes(8).toString('hex')}`;
    const roPrefix = rawRoKey.substring(0, 15) + '...';
    const roHash = crypto.createHash('sha256').update(rawRoKey).digest('hex');

    keys.push({
      _id: new Types.ObjectId(),
      tenantId: t._id,
      name: `${t.name} Read-Only Analytics Key`,
      keyHash: roHash,
      prefix: roPrefix,
      scopes: ['tickets:read', 'analytics:read'],
      lastUsedAt: new Date(Date.now() - 3600 * 1000 * 5),
      createdAt: new Date(Date.now() - 3600 * 1000 * 24 * 14),
    });
  }
  return keys;
}

export function generateWebhooks(tenants: any[]) {
  const webhooks: any[] = [];
  for (const t of tenants) {
    webhooks.push(
      {
        _id: new Types.ObjectId(),
        tenantId: t._id,
        url: `https://api.${t.slug}.com/webhooks/supportpilot`,
        events: ['ticket.created', 'ticket.updated', 'message.created'],
        secret: `whsec_${t.slug}_live_secret_7721`,
        active: true,
        description: `${t.name} Central ERP Webhook Integration`,
      },
      {
        _id: new Types.ObjectId(),
        tenantId: t._id,
        url: `https://hooks.slack.com/services/T00/B00/${t.slug.toUpperCase()}`,
        events: ['ticket.created'],
        secret: `whsec_slack_${t.slug}_9918`,
        active: true,
        description: 'Slack Escalations Channel Alerts',
      },
    );
  }
  return webhooks;
}

export function generateAuditLogs(tenants: any[], users: any[]) {
  const logs: any[] = [];
  const now = Date.now();

  const actions = [
    { action: 'AUTH_LOGIN', resource: 'User', meta: { method: 'password', ip: '192.168.1.100' } },
    {
      action: 'API_KEY_CREATED',
      resource: 'ApiKey',
      meta: { name: 'Production Gateway Key', scopes: ['tickets:read', 'tickets:write'] },
    },
    {
      action: 'SETTINGS_UPDATED',
      resource: 'Tenant',
      meta: { section: 'sla', updatedFields: ['sla.URGENT.firstResponseMin'] },
    },
    {
      action: 'DATA_EXPORTED',
      resource: 'Analytics',
      meta: { format: 'csv', range: 'last_30_days' },
    },
    {
      action: 'FEATURE_FLAG_TOGGLED',
      resource: 'FeatureFlag',
      meta: { key: 'ai_copilot', enabled: true },
    },
    { action: 'RULE_UPDATED', resource: 'Rule', meta: { ruleName: 'Urgent Outage Escalation' } },
    {
      action: 'WEBHOOK_CONFIGURED',
      resource: 'WebhookSubscription',
      meta: { url: 'https://api.domain.com/webhook' },
    },
    {
      action: 'USER_INVITED',
      resource: 'User',
      meta: { invitedRole: 'AGENT', email: 'newagent@domain.com' },
    },
  ];

  for (const t of tenants) {
    const tUsers = users.filter((u) => u.tenantId.equals(t._id));
    const user = tUsers[0];

    for (let i = 0; i < actions.length; i++) {
      const act = actions[i]!;
      logs.push({
        _id: new Types.ObjectId(),
        tenantId: t._id,
        userId: user?._id,
        userEmail: user?.email,
        action: act.action,
        resource: act.resource,
        resourceId: user?._id?.toString(),
        metadata: act.meta,
        ipAddress: `192.168.1.${100 + i}`,
        createdAt: new Date(now - 3600 * 1000 * (i * 12 + 1)),
      });
    }
  }

  return logs;
}

export async function runSeed(mode: string = 'memory'): Promise<SeedResult> {
  const isHermeticTest = mode === 'memory';

  // In test mode: 3 tenants, 50 tickets, 4 rules
  // In live mongo mode: ALL 6 tenants, 1,000 tickets, heavy data
  const tenantsToSeed = isHermeticTest ? SEED_DATA.tenants.slice(0, 3) : SEED_DATA.tenants;
  const usersToSeed = isHermeticTest ? SEED_DATA.users.slice(0, 8) : SEED_DATA.users;

  const ticketsPerTenant: { [key: string]: number } = isHermeticTest
    ? {
        '507f1f77bcf86cd799439011': 50,
        '507f1f77bcf86cd799439022': 0,
        '507f1f77bcf86cd799439033': 0,
      }
    : {
        '507f1f77bcf86cd799439011': 450, // Acme Corp
        '507f1f77bcf86cd799439022': 180, // Globex
        '507f1f77bcf86cd799439033': 80, // Initech
        '507f1f77bcf86cd799439044': 140, // Cyberdyne
        '507f1f77bcf86cd799439055': 90, // Wayne Enterprises
        '507f1f77bcf86cd799439066': 60, // Pied Piper
      };

  let allTickets: any[] = [];
  let allMessages: any[] = [];
  let allEvents: any[] = [];

  for (const t of tenantsToSeed) {
    const count = ticketsPerTenant[t._id.toString()] || 0;
    if (count > 0) {
      const tickets = generateSeedTickets(t._id, count, usersToSeed);
      const { messages, events } = generateSeedMessagesAndEvents(tickets, t._id, usersToSeed);
      allTickets.push(...tickets);
      allMessages.push(...messages);
      allEvents.push(...events);
    }
  }

  const featureFlags = generateFeatureFlags(tenantsToSeed);
  const rules = generateRules(tenantsToSeed, usersToSeed);
  const apiKeys = generateApiKeys(tenantsToSeed);
  const webhooks = generateWebhooks(tenantsToSeed);
  const auditLogs = generateAuditLogs(tenantsToSeed, usersToSeed);

  const counters = tenantsToSeed.map((t) => ({
    tenantId: t._id,
    key: 'ticket_number',
    value: ticketsPerTenant[t._id.toString()] || 50,
  }));

  const result: SeedResult = {
    tenantsCount: tenantsToSeed.length,
    usersCount: usersToSeed.length,
    ticketsCount: isHermeticTest ? 50 : allTickets.length,
    messagesCount: allMessages.length,
    ticketEventsCount: allEvents.length,
    rulesCount: isHermeticTest ? 4 : rules.length,
    featureFlagsCount: featureFlags.length,
    apiKeysCount: apiKeys.length,
    webhooksCount: webhooks.length,
    auditLogsCount: auditLogs.length,
    countersCount: counters.length,
  };

  if (!isHermeticTest && isDbConnected()) {
    // Clean and bulk-insert all collections
    await Tenant.deleteMany({});
    await Tenant.insertMany(tenantsToSeed);

    await User.deleteMany({});
    await User.insertMany(usersToSeed);

    await Customer.deleteMany({});
    await Customer.insertMany(SEED_CUSTOMERS);

    await Ticket.deleteMany({});
    // Batch insert tickets in chunks of 500
    for (let i = 0; i < allTickets.length; i += 500) {
      await Ticket.insertMany(allTickets.slice(i, i + 500));
    }

    await Message.deleteMany({});
    // Batch insert messages in chunks of 500
    for (let i = 0; i < allMessages.length; i += 500) {
      await Message.insertMany(allMessages.slice(i, i + 500));
    }

    await TicketEvent.deleteMany({});
    // Batch insert events in chunks of 500
    for (let i = 0; i < allEvents.length; i += 500) {
      await TicketEvent.insertMany(allEvents.slice(i, i + 500));
    }

    await FeatureFlagModel.deleteMany({});
    await FeatureFlagModel.insertMany(featureFlags);

    await RuleModel.deleteMany({});
    await RuleModel.insertMany(rules);

    await ApiKeyModel.deleteMany({});
    await ApiKeyModel.insertMany(apiKeys);

    await WebhookSubscriptionModel.deleteMany({});
    await WebhookSubscriptionModel.insertMany(webhooks);

    await AuditLogModel.deleteMany({});
    await AuditLogModel.insertMany(auditLogs);

    await Counter.deleteMany({});
    await Counter.insertMany(counters);
  }

  return result;
}
