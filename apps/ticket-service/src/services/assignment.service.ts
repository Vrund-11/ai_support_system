import { Types } from 'mongoose';
import { User } from '../models/user.model.js';
import { Ticket } from '../models/ticket.model.js';
import { getRedis } from '../lib/redis.js';

export type AssignmentAlgorithm = 'round-robin' | 'least-loaded';

export class AssignmentService {
  private static inMemoryCounters: Map<string, number> = new Map();

  /**
   * Selects the next agent to assign a ticket to within a tenant.
   * Supports 'round-robin' and 'least-loaded'.
   */
  static async getNextAgent(
    tenantId: string | Types.ObjectId,
    algorithm: AssignmentAlgorithm = 'round-robin',
  ): Promise<string | null> {
    const tenantObjectId = typeof tenantId === 'string' ? new Types.ObjectId(tenantId) : tenantId;
    const tenantStr = tenantObjectId.toString();

    // Find all active agents or leads for this tenant
    const agents = await User.find({
      tenantId: tenantObjectId,
      role: { $in: ['AGENT', 'LEAD'] },
      status: 'ACTIVE',
    })
      .sort({ _id: 1 })
      .select('_id')
      .lean();

    if (!agents || agents.length === 0) {
      return null;
    }

    if (algorithm === 'least-loaded') {
      const activeStatuses = ['NEW', 'OPEN', 'PENDING_CUSTOMER', 'ON_HOLD'];
      const agentIds = agents.map((a) => a._id);

      // Aggregate ticket counts per agent
      const counts = await Ticket.aggregate<{ _id: Types.ObjectId; count: number }>([
        {
          $match: {
            tenantId: tenantObjectId,
            status: { $in: activeStatuses },
            assigneeId: { $in: agentIds },
          },
        },
        {
          $group: {
            _id: '$assigneeId',
            count: { $sum: 1 },
          },
        },
      ]);

      const countMap = new Map<string, number>();
      for (const row of counts) {
        if (row._id) {
          countMap.set(row._id.toString(), row.count);
        }
      }

      // Find agent with lowest active ticket count
      let lowestAgent = agents[0]!;
      let minCount = countMap.get(lowestAgent._id.toString()) ?? 0;

      for (let i = 1; i < agents.length; i++) {
        const agent = agents[i]!;
        const currentCount = countMap.get(agent._id.toString()) ?? 0;
        if (currentCount < minCount) {
          minCount = currentCount;
          lowestAgent = agent;
        }
      }

      return lowestAgent._id.toString();
    }

    // Default: round-robin
    let index = 0;
    const key = `assignment:rr:${tenantStr}`;

    try {
      const redis = getRedis();
      const count = await redis.incr(key);
      index = (count - 1) % agents.length;
    } catch {
      // Fallback in-memory counter
      const current = AssignmentService.inMemoryCounters.get(tenantStr) ?? 0;
      index = current % agents.length;
      AssignmentService.inMemoryCounters.set(tenantStr, current + 1);
    }

    return agents[index]!._id.toString();
  }

  /** Reset in-memory counters (useful for unit tests) */
  static resetCounters(): void {
    AssignmentService.inMemoryCounters.clear();
  }
}
