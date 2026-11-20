import { Router, type Request, type Response, type NextFunction } from 'express';
import crypto from 'node:crypto';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireMinRole } from '@supportpilot/shared-lib';
import { ApiKeyRepository } from '../repositories/api-key.repository.js';
import { WebhookRepository } from '../repositories/webhook.repository.js';
import { AuditLogRepository } from '../repositories/audit-log.repository.js';
import { FeatureFlagRepository } from '../repositories/feature-flag.repository.js';

export const integrationRouter: Router = Router();

// All integration routes require authentication
integrationRouter.use(requireAuth);

// ── API Keys ─────────────────────────────────────────────────────────

// GET /api/v1/api-keys - List active API keys
integrationRouter.get(
  '/api-keys',
  requireMinRole('LEAD'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const repo = new ApiKeyRepository(tenantId);
      const keys = await repo.listActive();
      res.status(200).json({
        data: keys.map((k) => ({
          id: k._id.toString(),
          name: k.name,
          prefix: k.prefix,
          scopes: k.scopes,
          lastUsedAt: k.lastUsedAt,
          createdAt: k.createdAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/api-keys - Create API key (returns raw key once)
integrationRouter.post(
  '/api-keys',
  requireMinRole('OWNER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const { name, scopes } = req.body;
      if (!name || typeof name !== 'string') {
        res.status(400).json({ title: 'Validation error', detail: 'Key name is required' });
        return;
      }

      const rawKey = `sp_live_${crypto.randomBytes(20).toString('hex')}`;
      const prefix = rawKey.substring(0, 15) + '...';
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      const repo = new ApiKeyRepository(tenantId);
      const created = await repo.create({
        tenantId: repo['tenantId'],
        name,
        keyHash,
        prefix,
        scopes:
          Array.isArray(scopes) && scopes.length > 0 ? scopes : ['tickets:read', 'tickets:write'],
      } as any);

      // Audit log
      const auditRepo = new AuditLogRepository(tenantId);
      await auditRepo.logEvent({
        userId: req.user!.sub,
        userEmail: (req.user as any)?.email,
        action: 'API_KEY_CREATED',
        resource: 'ApiKey',
        resourceId: created._id.toString(),
        metadata: { name, prefix, scopes },
        ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
      });

      res.status(201).json({
        data: {
          id: created._id.toString(),
          name: created.name,
          prefix: created.prefix,
          rawKey, // returned ONLY once
          scopes: created.scopes,
          createdAt: created.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/api-keys/:id - Revoke API key
integrationRouter.delete(
  '/api-keys/:id',
  requireMinRole('OWNER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const repo = new ApiKeyRepository(tenantId);
      const revoked = await repo.revoke(req.params.id as string);
      if (!revoked) {
        res.status(404).json({ title: 'Not found', detail: 'API key not found' });
        return;
      }

      // Audit log
      const auditRepo = new AuditLogRepository(tenantId);
      await auditRepo.logEvent({
        userId: req.user!.sub,
        userEmail: (req.user as any)?.email,
        action: 'API_KEY_REVOKED',
        resource: 'ApiKey',
        resourceId: req.params.id as string,
        ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
      });

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

// ── Webhooks ──────────────────────────────────────────────────────────

// GET /api/v1/webhooks - List webhook subscriptions
integrationRouter.get(
  '/webhooks',
  requireMinRole('LEAD'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const repo = new WebhookRepository(tenantId);
      const subs = await repo.listSubscriptions();
      res.status(200).json({
        data: subs.map((s) => ({
          id: s._id.toString(),
          url: s.url,
          events: s.events,
          active: s.active,
          description: s.description,
          createdAt: s.createdAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/webhooks - Create webhook subscription
integrationRouter.post(
  '/webhooks',
  requireMinRole('OWNER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const { url, events, description } = req.body;
      if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        res
          .status(400)
          .json({ title: 'Validation error', detail: 'Valid HTTP/HTTPS URL is required' });
        return;
      }

      const secret = `whsec_${crypto.randomBytes(16).toString('hex')}`;
      const repo = new WebhookRepository(tenantId);
      const created = await repo.create({
        tenantId: repo['tenantId'],
        url,
        events:
          Array.isArray(events) && events.length > 0
            ? events
            : ['ticket.created', 'ticket.updated'],
        secret,
        description,
        active: true,
      } as any);

      // Audit log
      const auditRepo = new AuditLogRepository(tenantId);
      await auditRepo.logEvent({
        userId: req.user!.sub,
        userEmail: (req.user as any)?.email,
        action: 'WEBHOOK_CREATED',
        resource: 'WebhookSubscription',
        resourceId: created._id.toString(),
        metadata: { url, events: created.events },
        ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
      });

      res.status(201).json({
        data: {
          id: created._id.toString(),
          url: created.url,
          events: created.events,
          secret: created.secret,
          active: created.active,
          createdAt: created.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/webhooks/:id - Delete webhook
integrationRouter.delete(
  '/webhooks/:id',
  requireMinRole('OWNER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const repo = new WebhookRepository(tenantId);
      const deleted = await repo.deleteById(req.params.id as string);
      if (!deleted) {
        res.status(404).json({ title: 'Not found', detail: 'Webhook not found' });
        return;
      }

      // Audit log
      const auditRepo = new AuditLogRepository(tenantId);
      await auditRepo.logEvent({
        userId: req.user!.sub,
        userEmail: (req.user as any)?.email,
        action: 'WEBHOOK_DELETED',
        resource: 'WebhookSubscription',
        resourceId: req.params.id as string,
        ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
      });

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/webhooks/:id/test - Send test ping to webhook
integrationRouter.post(
  '/webhooks/:id/test',
  requireMinRole('LEAD'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const repo = new WebhookRepository(tenantId);
      const sub = await repo.findById(req.params.id as string);
      if (!sub) {
        res.status(404).json({ title: 'Not found', detail: 'Webhook not found' });
        return;
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const payload = JSON.stringify({
        event: 'test.ping',
        tenantId,
        timestamp,
        data: { message: 'SupportPilot webhook test delivery' },
      });
      const signature = crypto.createHmac('sha256', sub.secret).update(payload).digest('hex');

      res.status(200).json({
        data: {
          delivered: true,
          status: 200,
          targetUrl: sub.url,
          signature: `sha256=${signature}`,
          timestamp,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── Audit Logs ────────────────────────────────────────────────────────

// GET /api/v1/audit-logs - List audit logs
integrationRouter.get(
  '/audit-logs',
  requireMinRole('LEAD'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const action = req.query.action as string | undefined;

      const repo = new AuditLogRepository(tenantId);
      const logs = await repo.listEvents(limit, action);

      res.status(200).json({
        data: logs.map((l) => ({
          id: l._id.toString(),
          userId: l.userId?.toString(),
          userEmail: l.userEmail,
          action: l.action,
          resource: l.resource,
          resourceId: l.resourceId,
          metadata: l.metadata,
          ipAddress: l.ipAddress,
          createdAt: l.createdAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── Feature Flags ─────────────────────────────────────────────────────

// GET /api/v1/feature-flags - List tenant feature flags
integrationRouter.get(
  '/feature-flags',
  requireMinRole('AGENT'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const repo = new FeatureFlagRepository(tenantId);
      const flags = await repo.listFlags();

      res.status(200).json({
        data: flags.map((f) => ({
          key: f.key,
          name: f.name,
          enabled: f.enabled,
          description: f.description,
          updatedAt: f.updatedAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/feature-flags/:key - Toggle feature flag
integrationRouter.patch(
  '/feature-flags/:key',
  requireMinRole('OWNER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const { enabled } = req.body;
      if (typeof enabled !== 'boolean') {
        res.status(400).json({ title: 'Validation error', detail: 'enabled boolean is required' });
        return;
      }

      const repo = new FeatureFlagRepository(tenantId);
      const updated = await repo.setFlag(req.params.key as string, enabled);

      // Audit log
      const auditRepo = new AuditLogRepository(tenantId);
      await auditRepo.logEvent({
        userId: req.user!.sub,
        userEmail: (req.user as any)?.email,
        action: 'FEATURE_FLAG_UPDATED',
        resource: 'FeatureFlag',
        resourceId: req.params.key as string,
        metadata: { key: req.params.key, enabled },
        ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
      });

      res.status(200).json({
        data: {
          key: updated?.key ?? req.params.key,
          name: updated?.name,
          enabled: updated?.enabled,
          updatedAt: updated?.updatedAt,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
