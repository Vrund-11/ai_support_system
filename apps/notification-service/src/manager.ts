import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { randomUUID } from 'node:crypto';
import type { Logger } from '@supportpilot/shared-lib';
import type {
  NotificationQueueName,
  DeadLetterPayload,
  QueueMetrics,
  BaseJobPayload,
} from './types.js';
import { QUEUE_NAMES, DEFAULT_QUEUE_OPTIONS } from './queues.js';
import { NotificationDispatchers } from './workers.js';
import type { IdempotencyStore } from './idempotency.js';

export interface QueueManagerOptions {
  connection?: ConnectionOptions;
  idempotencyStore: IdempotencyStore;
  logger: Logger;
  enableWorkers?: boolean;
  inMemory?: boolean;
}

interface InMemoryJobRecord {
  id: string;
  name: string;
  data: BaseJobPayload;
  attemptsMade: number;
  maxAttempts: number;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  error?: string;
}

export class QueueManager {
  private queues = new Map<NotificationQueueName, Queue>();
  private workers = new Map<NotificationQueueName, Worker>();
  private inMemoryJobs = new Map<NotificationQueueName, InMemoryJobRecord[]>();
  private dlqRecords = new Map<string, DeadLetterPayload>();
  private dispatchers: NotificationDispatchers;
  private logger: Logger;
  private inMemory: boolean;

  constructor(private options: QueueManagerOptions) {
    this.logger = options.logger;
    this.inMemory = options.inMemory ?? false;
    this.dispatchers = new NotificationDispatchers(options.idempotencyStore, this.logger);

    for (const name of QUEUE_NAMES) {
      this.inMemoryJobs.set(name, []);
    }

    if (!this.inMemory) {
      // Initialize live BullMQ Queues
      for (const name of QUEUE_NAMES) {
        const queue = new Queue(name, {
          connection: options.connection || { host: 'localhost', port: 6379 },
          defaultJobOptions: DEFAULT_QUEUE_OPTIONS[name],
        });
        this.queues.set(name, queue);
      }

      if (options.enableWorkers !== false) {
        this.setupWorkers();
      }
    }
  }

  private setupWorkers(): void {
    const connection = this.options.connection || { host: 'localhost', port: 6379 };

    for (const name of QUEUE_NAMES) {
      const worker = new Worker(
        name,
        async (job) => {
          switch (name) {
            case 'email':
              return this.dispatchers.processEmail(job as never);
            case 'push':
              return this.dispatchers.processPush(job as never);
            case 'webhook':
              return this.dispatchers.processWebhook(job as never);
            case 'sla':
              return this.dispatchers.processSla(job as never);
            case 'audit':
              return this.dispatchers.processAudit(job as never);
            case 'dlq':
              return this.dispatchers.processDlq(job as never);
            default:
              throw new Error(`Unknown queue name: ${name}`);
          }
        },
        { connection },
      );

      worker.on('failed', async (job, err) => {
        if (!job) return;

        const maxAttempts = job.opts.attempts || 1;
        this.logger.error(
          {
            queue: name,
            jobId: job.id,
            attemptsMade: job.attemptsMade,
            maxAttempts,
            err: err.message,
          },
          'Worker job failed',
        );

        if (job.attemptsMade >= maxAttempts && name !== 'dlq') {
          await this.routeToDLQ(name, job, err);
        }
      });

      this.workers.set(name, worker);
    }
  }

  async routeToDLQ(
    originalQueue: NotificationQueueName,
    job: { id?: string; data: unknown },
    err: Error,
  ): Promise<DeadLetterPayload> {
    const payload = job.data as BaseJobPayload;
    const dlqId = `dlq_${randomUUID()}`;

    const dlqPayload: DeadLetterPayload = {
      dlqId,
      originalQueue,
      originalJobId: job.id,
      tenantId: payload.tenantId || 'unknown',
      payload: job.data,
      failedReason: err.message || 'Job attempts exhausted',
      attemptsMade: (job as { attemptsMade?: number }).attemptsMade || 1,
      failedAt: new Date().toISOString(),
    };

    // Store in DLQ repository
    this.dlqRecords.set(dlqId, dlqPayload);

    if (this.inMemory) {
      const dlqList = this.inMemoryJobs.get('dlq') || [];
      dlqList.push({
        id: dlqId,
        name: 'dead-letter',
        data: dlqPayload as never,
        attemptsMade: 1,
        maxAttempts: 1,
        status: 'completed',
      });
    } else {
      const dlqQueue = this.queues.get('dlq');
      if (dlqQueue) {
        await dlqQueue.add('dead-letter', dlqPayload, {
          jobId: dlqId,
        });
      }
    }

    this.logger.warn(
      { dlqId, originalQueue, tenantId: dlqPayload.tenantId },
      'Job successfully moved to dead-letter queue (DLQ)',
    );

    return dlqPayload;
  }

  async enqueue<T extends BaseJobPayload>(
    queueName: NotificationQueueName,
    data: T,
    opts?: { jobId?: string; delay?: number; attempts?: number },
  ): Promise<{ id: string; queue: NotificationQueueName }> {
    const defaultOpts = DEFAULT_QUEUE_OPTIONS[queueName];
    const jobId = opts?.jobId || data.idempotencyKey || `job_${randomUUID()}`;

    if (this.inMemory) {
      const list = this.inMemoryJobs.get(queueName) || [];
      const record: InMemoryJobRecord = {
        id: jobId,
        name: queueName,
        data,
        attemptsMade: 0,
        maxAttempts: opts?.attempts || defaultOpts.attempts || 1,
        status: opts?.delay ? 'delayed' : 'waiting',
      };
      list.push(record);

      return { id: jobId, queue: queueName };
    }

    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.add(queueName, data, {
      jobId,
      delay: opts?.delay,
      attempts: opts?.attempts,
    });

    return { id: job.id || jobId, queue: queueName };
  }

  async getMetrics(): Promise<QueueMetrics[]> {
    const metrics: QueueMetrics[] = [];

    if (this.inMemory) {
      for (const name of QUEUE_NAMES) {
        const jobs = this.inMemoryJobs.get(name) || [];
        metrics.push({
          queue: name,
          waiting: jobs.filter((j) => j.status === 'waiting').length,
          active: jobs.filter((j) => j.status === 'active').length,
          completed: jobs.filter((j) => j.status === 'completed').length,
          failed: jobs.filter((j) => j.status === 'failed').length,
          delayed: jobs.filter((j) => j.status === 'delayed').length,
        });
      }
      return metrics;
    }

    for (const [name, queue] of this.queues.entries()) {
      const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
      );
      metrics.push({
        queue: name,
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        delayed: counts.delayed || 0,
      });
    }

    return metrics;
  }

  getDLQRecords(tenantId: string): DeadLetterPayload[] {
    const results: DeadLetterPayload[] = [];
    for (const record of this.dlqRecords.values()) {
      if (record.tenantId === tenantId) {
        results.push(record);
      }
    }
    return results;
  }

  getDLQRecordById(dlqId: string, tenantId: string): DeadLetterPayload | null {
    const record = this.dlqRecords.get(dlqId);
    if (!record || record.tenantId !== tenantId) {
      return null;
    }
    return record;
  }

  async replayDLQRecord(
    dlqId: string,
    tenantId: string,
  ): Promise<{ success: boolean; newJobId: string }> {
    const record = this.getDLQRecordById(dlqId, tenantId);
    if (!record) {
      throw new Error(`DLQ record ${dlqId} not found or tenant unauthorized`);
    }

    const res = await this.enqueue(record.originalQueue, record.payload as BaseJobPayload);
    this.dlqRecords.delete(dlqId);

    this.logger.info(
      { dlqId, originalQueue: record.originalQueue, newJobId: res.id, tenantId },
      'DLQ job replayed into source queue',
    );

    return { success: true, newJobId: res.id };
  }

  getDispatchers(): NotificationDispatchers {
    return this.dispatchers;
  }

  async close(): Promise<void> {
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    for (const queue of this.queues.values()) {
      await queue.close();
    }
  }
}
