import mongoose from 'mongoose';
import Redis from 'ioredis';
import crypto from 'node:crypto';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { runSeed } from '../apps/ticket-service/src/seed.js';

const mode = process.env['SEED_MODE'] || 'mongo';
const mongoUri = process.env['MONGODB_URI'] || 'mongodb://127.0.0.1:27017/supportpilot';
const redisUrl = process.env['REDIS_URL'] || 'redis://127.0.0.1:6379';

console.log(`[Seed] Starting SupportPilot full database seed (mode: ${mode})...`);

function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function questionHash(normalized: string): string {
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

async function seedRedis(url: string) {
  try {
    const redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      enableOfflineQueue: false,
    });
    redis.on('error', (err) => {
      // suppress unhandled redis error in dev without docker
    });
    console.log('[Redis Seed] Connecting to Redis...');

    const acmeTenantId = '507f1f77bcf86cd799439011';

    // 1. Online Presence for all tenants
    const tenantsPresence: { [key: string]: string[] } = {
      '507f1f77bcf86cd799439011': [
        '507f191e810c19729de860aa', // Alice Owner
        '507f191e810c19729de860ab', // Bob Lead
        '507f191e810c19729de860ac', // Charlie Agent
        '507f191e810c19729de860ad', // Diana Support
        '507f191e810c19729de860ae', // Evan Triage
        '507f191e810c19729de860af', // Fiona Resolver
      ],
      '507f1f77bcf86cd799439022': [
        '507f191e810c19729de860ba', // Hank Scorpio
        '507f191e810c19729de860bb', // Gary Globex
        '507f191e810c19729de860bc', // Lisa Freight
        '507f191e810c19729de860bd', // Marco Logistics Lead
      ],
      '507f1f77bcf86cd799439033': [
        '507f191e810c19729de860ca', // Peter Gibbons
        '507f191e810c19729de860cb', // Milton Waddams
        '507f191e810c19729de860cc', // Bill Lumbergh
      ],
      '507f1f77bcf86cd799439044': [
        '507f191e810c19729de860da', // Miles Dyson
        '507f191e810c19729de860db', // John Connor
        '507f191e810c19729de860dc', // T-800
      ],
      '507f1f77bcf86cd799439055': [
        '507f191e810c19729de860ea', // Bruce Wayne
        '507f191e810c19729de860eb', // Lucius Fox
        '507f191e810c19729de860ec', // Alfred
      ],
      '507f1f77bcf86cd799439066': [
        '507f191e810c19729de860fa', // Richard Hendricks
        '507f191e810c19729de860fb', // Dinesh
        '507f191e810c19729de860fc', // Gilfoyle
        '507f191e810c19729de860fd', // Jared
      ],
    };

    for (const [tId, userIds] of Object.entries(tenantsPresence)) {
      await redis.sadd(`presence:tenant:${tId}`, ...userIds);
    }

    // 2. Chat sequence numbers across tenants
    await redis.set('seq:conv_acme_001', '45');
    await redis.set('seq:conv_acme_002', '28');
    await redis.set('seq:conv_globex_001', '19');
    await redis.set('seq:conv_cyberdyne_001', '32');
    await redis.set('seq:conv_wayne_001', '14');

    // 3. AI Semantic Response Cache
    const cacheQuestions = [
      {
        q: 'how do i configure sso',
        answer:
          'SupportPilot supports Single Sign-On (SSO) via SAML 2.0 and OpenID Connect (OIDC). Supported identity providers include Google Workspace, Okta, Microsoft Azure Active Directory, and PingIdentity. To configure SSO, the account Owner must upload the identity provider metadata XML document and specify the ACS URL and Entity ID found under Organization Settings > Security.',
        citations: [
          {
            doc_id: 'doc_auth_security',
            chunk_id: 'doc_auth_security_0',
            title: 'Section 1: Authentication and Account Security',
          },
        ],
        confidence: 0.98,
      },
      {
        q: 'what is your refund policy',
        answer:
          'All subscription fees are non-refundable after 14 calendar days from the initial purchase or renewal date. Refund requests submitted within 14 days of subscription initiation are processed back to the original credit card within 5 to 7 business days.',
        citations: [
          {
            doc_id: 'doc_billing_invoices',
            chunk_id: 'doc_billing_invoices_0',
            title: 'Section 2: Billing, Subscriptions, and Invoices',
          },
        ],
        confidence: 0.99,
      },
      {
        q: 'what are your subscription plans and pricing',
        answer:
          'SupportPilot offers three plans: Starter ($29/seat/mo or $24 billed annually, up to 5 seats), Growth ($79/seat/mo, up to 25 seats with live chat widgets and AI assistant routing), and Enterprise ($149/seat/mo with custom seat limits, dedicated account management, and high-volume vector search).',
        citations: [
          {
            doc_id: 'doc_billing_invoices',
            chunk_id: 'doc_billing_invoices_0',
            title: 'Section 2: Billing, Subscriptions, and Invoices',
          },
        ],
        confidence: 0.98,
      },
    ];

    for (const item of cacheQuestions) {
      const norm = normalizeQuestion(item.q);
      const hash = questionHash(norm);
      const payload = {
        answer: item.answer,
        citations: item.citations,
        confidence: item.confidence,
        should_escalate: false,
        reason: 'Cached response from verified KB corpus',
        provider: 'cache',
        tokens_used: 0,
      };
      await redis.set(`ai:cache:${acmeTenantId}:${hash}`, JSON.stringify(payload), 'EX', 86400 * 7);
    }

    console.log('✓ Redis seeded: online presence, chat sequence counters, and AI semantic cache.');
    redis.disconnect();
  } catch (err: any) {
    console.warn(
      '[Redis Seed] Notice: Redis seeding skipped or non-critical failure:',
      err?.message || err,
    );
  }
}

async function main() {
  if (mode === 'mongo') {
    await mongoose.connect(mongoUri);
    console.log(`[Seed] Connected to MongoDB at ${mongoUri}`);
  }

  const stats = await runSeed(mode);
  console.log('\n✓ MongoDB Seeding Complete:');
  console.log(`  - Tenants:         ${stats.tenantsCount}`);
  console.log(`  - Users:           ${stats.usersCount}`);
  console.log(`  - Tickets:         ${stats.ticketsCount}`);
  console.log(`  - Messages:        ${stats.messagesCount}`);
  console.log(`  - Ticket Events:   ${stats.ticketEventsCount}`);
  console.log(`  - Feature Flags:   ${stats.featureFlagsCount}`);
  console.log(`  - Automation Rules:${stats.rulesCount}`);
  console.log(`  - API Keys:        ${stats.apiKeysCount}`);
  console.log(`  - Webhooks:        ${stats.webhooksCount}`);
  console.log(`  - Audit Logs:      ${stats.auditLogsCount}`);
  console.log(`  - Counters:        ${stats.countersCount}`);

  if (mode === 'mongo') {
    await mongoose.disconnect();
  }

  // Seed Redis
  await seedRedis(redisUrl);

  // Seed PostgreSQL (Knowledge Base & Eval Runs)
  try {
    const rootDir = path.resolve(__dirname, '..');
    const pythonBin =
      process.platform === 'win32'
        ? path.join(rootDir, 'apps', 'ai-service', '.venv', 'Scripts', 'python.exe')
        : path.join(rootDir, 'apps', 'ai-service', '.venv', 'bin', 'python');
    const pgScript = path.join(rootDir, 'scripts', 'seed_postgres.py');
    console.log('\n[PostgreSQL Seed] Triggering PostgreSQL KB & Eval Seeding...');
    execSync(`"${pythonBin}" "${pgScript}"`, { stdio: 'inherit' });
  } catch (err: any) {
    console.warn(
      '[PostgreSQL Seed] Notice: PostgreSQL seeding skipped or error:',
      err?.message || err,
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[Seed] Failed:', err);
  process.exit(1);
});
