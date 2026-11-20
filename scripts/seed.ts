import { runSeed } from '../apps/ticket-service/src/seed.js';

const mode = process.env['SEED_MODE'] || 'memory';
console.log(`[Seed] Starting SupportPilot seed script (mode: ${mode})...`);

runSeed(mode)
  .then((stats) => {
    console.log('✓ Seeding complete:');
    console.log(`  - Tenants:       ${stats.tenantsCount}`);
    console.log(`  - Users:         ${stats.usersCount}`);
    console.log(`  - Tickets:       ${stats.ticketsCount}`);
    console.log(`  - Rules:         ${stats.rulesCount}`);
    console.log(`  - Feature Flags: ${stats.featureFlagsCount}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Seed] Failed:', err);
    process.exit(1);
  });
