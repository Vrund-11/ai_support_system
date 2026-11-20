import crypto from 'node:crypto';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { AppError } from '@supportpilot/shared-lib';
import { presignUploadSchema, registerKbDocumentSchema } from '@supportpilot/validators';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRoles } from '../middleware/rbac.middleware.js';
import { storageService } from '../services/storage.service.js';

export const kbRouter: Router = Router();

export interface KbDocRecord {
  id: string;
  documentId: string;
  tenantId: string;
  title: string;
  source: string;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  chunksCount: number;
  key?: string;
  updatedAt: string;
}

// In-memory registry for KB documents across tenants
const kbRegistry: Map<string, KbDocRecord[]> = new Map();

export function getKbRegistry(): Map<string, KbDocRecord[]> {
  return kbRegistry;
}

export function resetKbRegistry(): void {
  kbRegistry.clear();
}

kbRouter.use(requireAuth);

/**
 * GET /api/v1/kb/documents
 * List all knowledge base documents for tenant (AGENT+).
 */
kbRouter.get(
  '/documents',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        throw new AppError(401, 'Tenant authentication required', '/errors/unauthorized');
      }
      const docs = kbRegistry.get(tenantId) ?? [];
      res.status(200).json({ data: docs });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/kb/documents/:id
 * Get single knowledge base document details (AGENT+).
 */
kbRouter.get(
  '/documents/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        throw new AppError(401, 'Tenant authentication required', '/errors/unauthorized');
      }
      const docId = Array.isArray(req.params['id']) ? req.params['id'][0]! : req.params['id']!;
      const docs = kbRegistry.get(tenantId) ?? [];
      const found = docs.find((d) => d.id === docId || d.documentId === docId);
      if (!found) {
        throw new AppError(404, 'Knowledge base document not found', '/errors/not-found');
      }
      res.status(200).json({ data: found });
    } catch (err) {
      next(err);
    }
  },
);

// Upload and registration endpoints restricted to OWNER and LEAD per PRD KB-1
kbRouter.post(
  '/uploads/presign',
  requireRoles('OWNER', 'LEAD'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = presignUploadSchema.safeParse({
        ...req.body,
        purpose: 'kb_document',
      });

      if (!parsed.success) {
        res.status(400).json({
          type: 'https://supportpilot.dev/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: parsed.error.issues.map((i) => i.message).join(', '),
        });
        return;
      }

      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        throw new AppError(401, 'Tenant authentication required', '/errors/unauthorized');
      }

      const result = await storageService.generatePresignedUpload(tenantId, parsed.data);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

kbRouter.post(
  '/documents',
  requireRoles('OWNER', 'LEAD'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = registerKbDocumentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          type: 'https://supportpilot.dev/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: parsed.error.issues.map((i) => i.message).join(', '),
        });
        return;
      }

      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        throw new AppError(401, 'Tenant authentication required', '/errors/unauthorized');
      }

      const { title, source, key, contentType } = parsed.data;

      // If uploaded file key is provided, verify tenant ownership and magic bytes
      if (key) {
        await storageService.verifyUploadedFile(tenantId, key, contentType);
      }

      const documentId = crypto.randomUUID();
      const record: KbDocRecord = {
        id: documentId,
        documentId,
        tenantId,
        title,
        source,
        status: 'PENDING',
        chunksCount: 6,
        key,
        updatedAt: new Date().toISOString(),
      };

      const existing = kbRegistry.get(tenantId) ?? [];
      existing.unshift(record);
      kbRegistry.set(tenantId, existing);

      res.status(202).json({
        documentId,
        title,
        source,
        status: 'PENDING',
        chunksCount: record.chunksCount,
        key,
        message: 'Document registered and queued for ingestion',
      });
    } catch (err) {
      next(err);
    }
  },
);
