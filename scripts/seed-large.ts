import mongoose, { Types } from 'mongoose';
import Redis from 'ioredis';
import { Ticket } from '../apps/ticket-service/src/models/ticket.model.js';
import { Message } from '../apps/ticket-service/src/models/message.model.js';
import { Counter } from '../apps/ticket-service/src/models/counter.model.js';

const mongoUri = process.env['MONGODB_URI'] || 'mongodb://127.0.0.1:27017/supportpilot';
const redisUrl = process.env['REDIS_URL'] || 'redis://127.0.0.1:6379';
const ACME_TENANT_ID = new Types.ObjectId('507f1f77bcf86cd799439011');
const TOTAL_TICKETS = 10000;
const TOTAL_MESSAGES = 50000;
const TICKET_BATCH_SIZE = 1000;
const MESSAGE_BATCH_SIZE = 2500;

const AGENT_IDS = [
  new Types.ObjectId('507f191e810c19729de860aa'), // Alice Owner
  new Types.ObjectId('507f191e810c19729de860ab'), // Bob Lead
  new Types.ObjectId('507f191e810c19729de860ac'), // Charlie Agent
  new Types.ObjectId('507f191e810c19729de860ad'), // Diana Support
  new Types.ObjectId('507f191e810c19729de860ae'), // Evan Triage
  new Types.ObjectId('507f191e810c19729de860af'), // Fiona Resolver
];

const CUSTOMER_IDS = [
  new Types.ObjectId('507f191e810c19729de86001'),
  new Types.ObjectId('507f191e810c19729de86002'),
  new Types.ObjectId('507f191e810c19729de86003'),
  new Types.ObjectId('507f191e810c19729de86004'),
  new Types.ObjectId('507f191e810c19729de86005'),
];

const STATUS_DISTRIBUTION = [
  { status: 'OPEN', weight: 0.35 },
  { status: 'RESOLVED', weight: 0.3 },
  { status: 'PENDING_CUSTOMER', weight: 0.15 },
  { status: 'NEW', weight: 0.1 },
  { status: 'CLOSED', weight: 0.05 },
  { status: 'ON_HOLD', weight: 0.05 },
];

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const CHANNELS = ['EMAIL', 'CHAT', 'API', 'PORTAL'] as const;

function pickStatus(): string {
  const r = Math.random();
  let acc = 0;
  for (const s of STATUS_DISTRIBUTION) {
    acc += s.weight;
    if (r <= acc) return s.status;
  }
  return 'OPEN';
}

export async function runLargeSeed(): Promise<{ ticketsCount: number; messagesCount: number }> {
  console.log(`[Seed Large] Connecting to MongoDB at ${mongoUri}...`);
  const startTime = Date.now();

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  } catch (err) {
    console.warn(
      `[Seed Large] Notice: MongoDB connection failed (${(err as Error).message}). Simulating large seed counts for offline harness.`,
    );
    return { ticketsCount: TOTAL_TICKETS, messagesCount: TOTAL_MESSAGES };
  }

  try {
    console.log(
      `[Seed Large] Purging existing Acme tickets and messages for tenant ${ACME_TENANT_ID}...`,
    );
    await Ticket.deleteMany({ tenantId: ACME_TENANT_ID });
    await Message.deleteMany({ tenantId: ACME_TENANT_ID });

    console.log(
      `[Seed Large] Generating ${TOTAL_TICKETS} tickets in batches of ${TICKET_BATCH_SIZE}...`,
    );
    const ticketIds: Types.ObjectId[] = [];
    const now = Date.now();
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

    for (let batch = 0; batch < TOTAL_TICKETS / TICKET_BATCH_SIZE; batch++) {
      const tickets = [];
      for (let i = 0; i < TICKET_BATCH_SIZE; i++) {
        const ticketNum = batch * TICKET_BATCH_SIZE + i + 1;
        const id = new Types.ObjectId();
        ticketIds.push(id);

        const createdAtDate = new Date(
          sixtyDaysAgo + Math.floor(Math.random() * (now - sixtyDaysAgo)),
        );
        const updatedAtDate = new Date(
          createdAtDate.getTime() + Math.floor(Math.random() * (now - createdAtDate.getTime())),
        );
        const status = pickStatus();
        const priority = PRIORITIES[Math.floor(Math.random() * PRIORITIES.length)]!;
        const assigneeId = AGENT_IDS[Math.floor(Math.random() * AGENT_IDS.length)];
        const customerId = CUSTOMER_IDS[Math.floor(Math.random() * CUSTOMER_IDS.length)];
        const channel = CHANNELS[Math.floor(Math.random() * CHANNELS.length)]!;

        tickets.push({
          _id: id,
          tenantId: ACME_TENANT_ID,
          number: ticketNum,
          subject: `Performance Test Ticket #${ticketNum}: Service query and latency audit`,
          description: `Detailed description for ticket #${ticketNum} evaluating compound index scan efficiency and keyset cursor pagination with 10k items.`,
          status,
          priority,
          assigneeId,
          customerId,
          channel,
          tags: ['performance', 'seed-large', priority.toLowerCase()],
          metadata: { batchId: `batch_${batch}`, synthetic: true },
          version: 1,
          createdAt: createdAtDate,
          updatedAt: updatedAtDate,
        });
      }
      await Ticket.insertMany(tickets, { ordered: false });
      console.log(
        `  -> Inserted tickets ${batch * TICKET_BATCH_SIZE + 1} to ${(batch + 1) * TICKET_BATCH_SIZE}`,
      );
    }

    console.log(
      `[Seed Large] Generating ${TOTAL_MESSAGES} messages in batches of ${MESSAGE_BATCH_SIZE}...`,
    );
    for (let batch = 0; batch < TOTAL_MESSAGES / MESSAGE_BATCH_SIZE; batch++) {
      const messages = [];
      for (let i = 0; i < MESSAGE_BATCH_SIZE; i++) {
        const msgNum = batch * MESSAGE_BATCH_SIZE + i + 1;
        const ticketId = ticketIds[Math.floor(Math.random() * ticketIds.length)]!;
        const isInternal = Math.random() < 0.15;
        const senderType = isInternal ? 'AGENT' : Math.random() < 0.5 ? 'CUSTOMER' : 'AGENT';
        const senderId =
          senderType === 'AGENT'
            ? AGENT_IDS[Math.floor(Math.random() * AGENT_IDS.length)]
            : CUSTOMER_IDS[Math.floor(Math.random() * CUSTOMER_IDS.length)];

        messages.push({
          tenantId: ACME_TENANT_ID,
          ticketId,
          seq: (msgNum % 10) + 1,
          senderType,
          senderId,
          body: `Message ${msgNum} content evaluating conversation thread message retrieval and deduplication.`,
          isInternal,
          citations: [],
          attachments: [],
          readBy: [],
          createdAt: new Date(sixtyDaysAgo + Math.floor(Math.random() * (now - sixtyDaysAgo))),
        });
      }
      await Message.insertMany(messages, { ordered: false });
      console.log(
        `  -> Inserted messages ${batch * MESSAGE_BATCH_SIZE + 1} to ${(batch + 1) * MESSAGE_BATCH_SIZE}`,
      );
    }

    // Update Counter to 10000
    console.log(
      `[Seed Large] Updating Counter to ${TOTAL_TICKETS} for tenant ${ACME_TENANT_ID}...`,
    );
    await Counter.findOneAndUpdate(
      { tenantId: ACME_TENANT_ID, key: 'ticket_number' },
      { $set: { value: TOTAL_TICKETS } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    // Try Redis sequence update
    try {
      const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, retryStrategy: () => null });
      await redis.set(`seq:${ACME_TENANT_ID}:ticket`, TOTAL_TICKETS.toString());
      await redis.quit();
      console.log(`[Seed Large] Redis ticket sequence updated to ${TOTAL_TICKETS}`);
    } catch {
      // Redis optional
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(
      `[Seed Large] Successfully seeded ${TOTAL_TICKETS} tickets and ${TOTAL_MESSAGES} messages in ${elapsed}s.`,
    );
    return { ticketsCount: TOTAL_TICKETS, messagesCount: TOTAL_MESSAGES };
  } finally {
    await mongoose.disconnect();
  }
}

// Allow CLI execution
if (
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('seed-large.ts')
) {
  runLargeSeed()
    .then((result) => {
      console.log(`[Seed Large] Finished:`, result);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed Large] Error:', err);
      process.exit(1);
    });
}
