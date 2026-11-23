import mongoose, { Types } from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { Ticket } from '../apps/ticket-service/src/models/ticket.model.js';

interface LatencyStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
}

function computeStats(timings: number[]): LatencyStats {
  if (timings.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0, p95: 0 };
  }
  const sorted = [...timings].sort((a, b) => a - b);
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = sum / sorted.length;

  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;

  const p95Idx = Math.min(Math.ceil(0.95 * sorted.length) - 1, sorted.length - 1);
  const p95 = sorted[p95Idx]!;

  return {
    min: Number(min.toFixed(4)),
    max: Number(max.toFixed(4)),
    mean: Number(mean.toFixed(4)),
    median: Number(median.toFixed(4)),
    p95: Number(p95.toFixed(4)),
  };
}

async function connectToMongo(): Promise<string> {
  const mongoUri = process.env['MONGODB_URI'] || 'mongodb://127.0.0.1:27017/supportpilot';

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    console.log(`[measure-perf] Connected to MongoDB at ${mongoUri}`);
    return mongoUri;
  } catch (initialErr) {
    console.warn(
      `[measure-perf] Failed initial connection to ${mongoUri}: ${(initialErr as Error).message}`,
    );
    console.log(
      '[measure-perf] Attempting to ensure sp-mongo container is running via docker compose...',
    );

    try {
      execSync('docker compose -f infra/docker-compose.infra.yml up -d mongo', {
        stdio: 'inherit',
      });
      console.log('[measure-perf] Waiting for MongoDB container to initialize...');

      for (let attempt = 1; attempt <= 10; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        try {
          await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
          console.log(`[measure-perf] Connected to MongoDB on attempt ${attempt}`);
          return mongoUri;
        } catch {
          console.log(`[measure-perf] Waiting for MongoDB... (attempt ${attempt}/10)`);
        }
      }
    } catch (dockerErr) {
      console.error('[measure-perf] Docker compose start failed:', dockerErr);
    }

    throw new Error(`Unable to connect to MongoDB at ${mongoUri}`);
  }
}

async function ensureIndexesAndSeed(tenantId: Types.ObjectId, minMatchingTickets: number = 600) {
  // Ensure compound indexes exist for keyset and offset pagination
  console.log('[measure-perf] Ensuring compound indexes...');
  try {
    await Ticket.collection.createIndex({
      tenantId: 1,
      status: 1,
      priority: 1,
      updatedAt: -1,
      _id: -1,
    });
  } catch (err: any) {
    if (err.code !== 85) throw err;
  }
  try {
    await Ticket.collection.createIndex({ tenantId: 1, status: 1, priority: 1, updatedAt: -1 });
  } catch (err: any) {
    if (err.code !== 85) throw err;
  }
  try {
    await Ticket.collection.createIndex({ tenantId: 1, updatedAt: -1, _id: -1 });
  } catch (err: any) {
    if (err.code !== 85) throw err;
  }

  const currentMatching = await Ticket.countDocuments({
    tenantId,
    status: 'OPEN',
    priority: 'HIGH',
  });
  console.log(
    `[measure-perf] Found ${currentMatching} matching tickets (status='OPEN', priority='HIGH') for tenant ${tenantId}`,
  );

  if (currentMatching < minMatchingTickets) {
    const toSeed = minMatchingTickets - currentMatching + 200;
    console.log(
      `[measure-perf] Matching tickets below threshold (${currentMatching} < ${minMatchingTickets}). Seeding ${toSeed} tickets...`,
    );

    const statuses = ['OPEN', 'PENDING_CUSTOMER', 'RESOLVED', 'CLOSED'] as const;
    const priorities = ['HIGH', 'MEDIUM', 'LOW', 'URGENT'] as const;
    const customerId = new Types.ObjectId('507f191e810c19729de860ea');

    const maxTicket = await Ticket.findOne({ tenantId })
      .sort({ number: -1 })
      .select('number')
      .lean();
    let nextNumber = (maxTicket?.number ?? 0) + 1;

    const now = Date.now();
    const batchSize = 500;
    const docs = [];

    for (let i = 0; i < toSeed; i++) {
      // 80% OPEN + HIGH to quickly meet benchmark threshold
      const isTarget = i % 10 < 8;
      const status = isTarget ? 'OPEN' : statuses[i % statuses.length]!;
      const priority = isTarget ? 'HIGH' : priorities[i % priorities.length]!;

      const timeOffset = (toSeed - i) * 60_000 + (i % 1000);
      const createdAt = new Date(now - timeOffset);
      const updatedAt = new Date(now - timeOffset + 5000);

      docs.push({
        tenantId,
        number: nextNumber++,
        subject: `Benchmark performance ticket #${nextNumber}`,
        description: `Synthetic ticket generated for offset vs keyset benchmark #${nextNumber}`,
        status,
        priority,
        customerId,
        tags: ['perf', 'benchmark'],
        attachments: [],
        customFields: {},
        linkedTicketIds: [],
        version: 1,
        createdAt,
        updatedAt,
      });

      if (docs.length >= batchSize) {
        await Ticket.collection.insertMany(docs, { ordered: false });
        docs.length = 0;
      }
    }

    if (docs.length > 0) {
      await Ticket.collection.insertMany(docs, { ordered: false });
    }

    const updatedCount = await Ticket.countDocuments({
      tenantId,
      status: 'OPEN',
      priority: 'HIGH',
    });
    console.log(`[measure-perf] Seeding complete. Matching tickets now: ${updatedCount}`);
  }
}

async function main() {
  console.log('================================================================');
  console.log(' SupportPilot Rigorous Performance Benchmark: Offset vs Keyset ');
  console.log('================================================================');

  await connectToMongo();
  const tenantId = new Types.ObjectId('507f1f77bcf86cd799439011');

  // Verify and seed tickets if necessary
  await ensureIndexesAndSeed(tenantId, 600);

  const pageSize = 20;
  const offset = 500; // Deep pagination to accurately reflect offset scan penalty
  const warmupRuns = 5;
  const timedRuns = 30;

  // Retrieve cursor document at position (offset - 1) for keyset pagination
  const cursorDoc = await Ticket.find({ tenantId, status: 'OPEN', priority: 'HIGH' })
    .sort({ updatedAt: -1, _id: -1 })
    .skip(offset - 1)
    .limit(1)
    .lean();

  if (!cursorDoc.length || !cursorDoc[0]) {
    throw new Error(
      `Insufficient tickets: unable to locate cursor document at offset ${offset - 1}`,
    );
  }

  const cursorDate = cursorDoc[0].updatedAt;
  const cursorId = cursorDoc[0]._id;

  // IDENTICAL query filters
  const offsetFilter = {
    tenantId,
    status: 'OPEN',
    priority: 'HIGH',
  };

  const keysetFilter = {
    tenantId,
    status: 'OPEN',
    priority: 'HIGH',
    $or: [{ updatedAt: { $lt: cursorDate } }, { updatedAt: cursorDate, _id: { $lt: cursorId } }],
  };

  console.log(`\nBenchmark Configuration:`);
  console.log(`- Tenant ID:      ${tenantId}`);
  console.log(`- Filter:         { tenantId, status: 'OPEN', priority: 'HIGH' }`);
  console.log(`- Sort:           { updatedAt: -1, _id: -1 }`);
  console.log(`- Page Size:      ${pageSize}`);
  console.log(`- Offset Tested:  ${offset}`);
  console.log(`- Cursor Date:    ${cursorDate.toISOString()}`);
  console.log(`- Cursor ID:      ${cursorId}`);
  console.log(`- Warm-up Runs:   ${warmupRuns}`);
  console.log(`- Timed Runs:     ${timedRuns}`);

  // Result verification: confirm both queries return identical records
  const offsetVerify = await Ticket.find(offsetFilter)
    .sort({ updatedAt: -1, _id: -1 })
    .skip(offset)
    .limit(pageSize)
    .lean();

  const keysetVerify = await Ticket.find(keysetFilter)
    .sort({ updatedAt: -1, _id: -1 })
    .limit(pageSize)
    .lean();

  const countsMatch = offsetVerify.length === pageSize && keysetVerify.length === pageSize;
  const idsMatch =
    countsMatch &&
    offsetVerify.every((doc, idx) => doc._id.toString() === keysetVerify[idx]?._id.toString());

  console.log(`\nQuery Equivalence Verification:`);
  console.log(`- Offset returned: ${offsetVerify.length} docs`);
  console.log(`- Keyset returned: ${keysetVerify.length} docs`);
  console.log(
    `- Exact Document ID Match: ${idsMatch ? 'PASSED (100% identical results)' : 'FAILED'}`,
  );

  if (!idsMatch) {
    console.warn(
      '[WARNING] Keyset and offset queries did not return identical document sequences!',
    );
  }

  // 1. Warm-up Phase (5 unmeasured/discarded runs)
  console.log(`\nExecuting ${warmupRuns} warm-up runs...`);
  for (let w = 0; w < warmupRuns; w++) {
    await Ticket.find(offsetFilter)
      .sort({ updatedAt: -1, _id: -1 })
      .skip(offset)
      .limit(pageSize)
      .lean();
    await Ticket.find(keysetFilter).sort({ updatedAt: -1, _id: -1 }).limit(pageSize).lean();
  }
  console.log('Warm-up completed.');

  // 2. Timed Runs Phase (30 measured runs with performance.now())
  console.log(`\nExecuting ${timedRuns} timed benchmark runs...`);
  const offsetTimings: number[] = [];
  const keysetTimings: number[] = [];

  for (let i = 0; i < timedRuns; i++) {
    // Offset measurement
    const t0 = performance.now();
    await Ticket.find(offsetFilter)
      .sort({ updatedAt: -1, _id: -1 })
      .skip(offset)
      .limit(pageSize)
      .lean();
    const t1 = performance.now();
    const offsetDuration = t1 - t0;
    offsetTimings.push(offsetDuration);

    // Keyset measurement
    const t2 = performance.now();
    await Ticket.find(keysetFilter).sort({ updatedAt: -1, _id: -1 }).limit(pageSize).lean();
    const t3 = performance.now();
    const keysetDuration = t3 - t2;
    keysetTimings.push(keysetDuration);

    process.stdout.write(
      `  Run ${String(i + 1).padStart(2)}: Offset = ${offsetDuration.toFixed(3)} ms | Keyset = ${keysetDuration.toFixed(3)} ms\n`,
    );
  }

  // 3. Statistical Analysis
  const offsetStats = computeStats(offsetTimings);
  const keysetStats = computeStats(keysetTimings);

  // Speedup supported ONLY when supported by median values
  const speedupSupported = offsetStats.median > keysetStats.median;
  const speedup = speedupSupported
    ? Number((((offsetStats.median - keysetStats.median) / offsetStats.median) * 100).toFixed(2))
    : 0;

  console.log('\n================================================================');
  console.log(' Benchmark Results & Statistical Summary');
  console.log('================================================================');
  console.log(`Metric           | Baseline (Offset) | Optimized (Keyset)`);
  console.log(`-----------------+-------------------+-------------------`);
  console.log(
    `Min Latency      | ${offsetStats.min.toFixed(4).padStart(13)} ms | ${keysetStats.min.toFixed(4).padStart(13)} ms`,
  );
  console.log(
    `Max Latency      | ${offsetStats.max.toFixed(4).padStart(13)} ms | ${keysetStats.max.toFixed(4).padStart(13)} ms`,
  );
  console.log(
    `Mean Latency     | ${offsetStats.mean.toFixed(4).padStart(13)} ms | ${keysetStats.mean.toFixed(4).padStart(13)} ms`,
  );
  console.log(
    `Median (p50)     | ${offsetStats.median.toFixed(4).padStart(13)} ms | ${keysetStats.median.toFixed(4).padStart(13)} ms`,
  );
  console.log(
    `95th %ile (p95)  | ${offsetStats.p95.toFixed(4).padStart(13)} ms | ${keysetStats.p95.toFixed(4).padStart(13)} ms`,
  );
  console.log(`-----------------+-------------------+-------------------`);

  if (speedupSupported) {
    console.log(`Median Speedup:   ${speedup}% faster using keyset cursor pagination`);
    console.log(
      `Formula:          ((${offsetStats.median} - ${keysetStats.median}) / ${offsetStats.median}) * 100 = ${speedup}%`,
    );
  } else {
    console.log(
      `Median Speedup:   Not observed (Keyset median ${keysetStats.median} ms >= Offset median ${offsetStats.median} ms)`,
    );
  }
  console.log('================================================================\n');

  // 4. Save Raw JSON Results
  const benchmarkResult = {
    benchmark: 'MongoDB Pagination: Offset vs Keyset Cursor',
    timestamp: new Date().toISOString(),
    tenantId: tenantId.toString(),
    filter: {
      status: 'OPEN',
      priority: 'HIGH',
    },
    sort: {
      updatedAt: -1,
      _id: -1,
    },
    pageSize,
    offset,
    cursor: {
      date: cursorDate.toISOString(),
      id: cursorId.toString(),
    },
    warmupRuns,
    timedRuns,
    equivalenceVerification: {
      offsetReturnedCount: offsetVerify.length,
      keysetReturnedCount: keysetVerify.length,
      exactMatch: idsMatch,
    },
    offsetPagination: {
      method: 'skip(offset).limit(pageSize)',
      timingsMs: offsetTimings.map((t) => Number(t.toFixed(4))),
      stats: offsetStats,
    },
    keysetPagination: {
      method:
        'cursor($or: [{ updatedAt: < cursorDate }, { updatedAt: cursorDate, _id: < cursorId }]).limit(pageSize)',
      timingsMs: keysetTimings.map((t) => Number(t.toFixed(4))),
      stats: keysetStats,
    },
    speedupPercent: speedup,
    speedupSupportedByMedian: speedupSupported,
  };

  const outDir = path.resolve(process.cwd(), 'evidence/reaudit2');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, 'perf-benchmark.json');
  fs.writeFileSync(outPath, JSON.stringify(benchmarkResult, null, 2) + '\n', 'utf8');
  console.log(`[measure-perf] Raw JSON benchmark written to: ${outPath}`);

  await mongoose.disconnect();
  console.log('[measure-perf] Disconnected from MongoDB. Benchmark completed successfully.');
}

main().catch((err) => {
  console.error('[measure-perf] Fatal benchmark error:', err);
  process.exit(1);
});
