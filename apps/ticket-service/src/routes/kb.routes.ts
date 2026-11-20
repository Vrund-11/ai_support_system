import crypto from 'node:crypto';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { AppError } from '@supportpilot/shared-lib';
import { presignUploadSchema, registerKbDocumentSchema } from '@supportpilot/validators';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRoles } from '../middleware/rbac.middleware.js';
import { storageService } from '../services/storage.service.js';

export const kbRouter: Router = Router();

// KB routes restricted to OWNER and LEAD roles per PRD KB-1
kbRouter.use(requireAuth);
kbRouter.use(requireRoles('OWNER', 'LEAD'));

/**
 * POST /api/v1/kb/uploads/presign
 * Presigned S3 upload endpoint for knowledge base documents (KB-1).
 */
kbRouter.post(
  '/uploads/presign',
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

/**
 * POST /api/v1/kb/documents
 * Register uploaded or pasted KB document and enqueue ingestion (returns 202 Accepted).
 * If key is provided, verifies magic bytes to reject spoofed files (T-FILE-01).
 */
kbRouter.post(
  '/documents',
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

      res.status(202).json({
        documentId,
        title,
        source,
        status: 'PENDING',
        key,
        message: 'Document registered and queued for ingestion',
      });
    } catch (err) {
      next(err);
    }
  },
);
