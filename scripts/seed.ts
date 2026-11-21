import mongoose from 'mongoose';
import { runSeed } from '../apps/ticket-service/src/seed.js';

const mode = process.env['SEED_MODE'] || 'mongo';
const uri = process.env['MONGODB_URI'] || 'mongodb://127.0.0.1:27017/supportpilot';

console.log(`[Seed] Starting SupportPilot seed script (mode: ${mode})...`);

async function main() {
  if (mode === 'mongo') {
    await mongoose.connect(uri);
    console.log(`[Seed] Connected to MongoDB at ${uri}`);
  }

  const stats = await runSeed(mode);
  console.log('✓ Seeding complete:');
  console.log(`  - Tenants:       ${stats.tenantsCount}`);
  console.log(`  - Users:         ${stats.usersCount}`);
  console.log(`  - Tickets:       ${stats.ticketsCount}`);
  console.log(`  - Rules:         ${stats.rulesCount}`);
  console.log(`  - Feature Flags: ${stats.featureFlagsCount}`);

  if (mode === 'mongo') {
    await mongoose.disconnect();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('[Seed] Failed:', err);
  process.exit(1);
});
