import mongoose, { Types } from 'mongoose';
import { Ticket } from '../apps/ticket-service/src/models/ticket.model.js';

async function main() {
  const mongoUri = process.env['MONGODB_URI'] || 'mongodb://127.0.0.1:27017/supportpilot';
  await mongoose.connect(mongoUri);
  const tenantId = new Types.ObjectId('507f1f77bcf86cd799439011');

  console.log('--- 1. Query: status=OPEN sort by _id:-1 limit 25 (Baseline) ---');
  const res1 = (await Ticket.find({ tenantId, status: 'OPEN' })
    .sort({ _id: -1 })
    .limit(25)
    .explain('executionStats')) as any;

  console.log('nReturned:', res1.executionStats.nReturned);
  console.log('executionTimeMillis:', res1.executionStats.executionTimeMillis);
  console.log('totalKeysExamined:', res1.executionStats.totalKeysExamined);
  console.log('totalDocsExamined:', res1.executionStats.totalDocsExamined);
  console.log('stage:', res1.executionStats.executionStages.stage);

  console.log('\n--- 2. Query: status=OPEN, priority=HIGH sort by updatedAt:-1 limit 20 ---');
  const res2 = (await Ticket.find({ tenantId, status: 'OPEN', priority: 'HIGH' })
    .sort({ updatedAt: -1, _id: -1 })
    .limit(20)
    .explain('executionStats')) as any;

  console.log('nReturned:', res2.executionStats.nReturned);
  console.log('executionTimeMillis:', res2.executionStats.executionTimeMillis);
  console.log('totalKeysExamined:', res2.executionStats.totalKeysExamined);
  console.log('totalDocsExamined:', res2.executionStats.totalDocsExamined);
  console.log('stage:', res2.executionStats.executionStages.stage);

  console.log('\n--- 3. Query: Keyset Cursor Pagination on (updatedAt, _id) ---');
  // Sample one ticket to get cursor
  const sample = await Ticket.findOne({ tenantId }).sort({ updatedAt: -1, _id: -1 });
  if (sample) {
    const res3 = (await Ticket.find({
      tenantId,
      $or: [
        { updatedAt: { $lt: sample.updatedAt } },
        { updatedAt: sample.updatedAt, _id: { $lt: sample._id } },
      ],
    })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(20)
      .explain('executionStats')) as any;

    console.log('Keyset nReturned:', res3.executionStats.nReturned);
    console.log('Keyset executionTimeMillis:', res3.executionStats.executionTimeMillis);
    console.log('Keyset totalKeysExamined:', res3.executionStats.totalKeysExamined);
    console.log('Keyset totalDocsExamined:', res3.executionStats.totalDocsExamined);
    console.log('Keyset stage:', res3.executionStats.executionStages.stage);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
