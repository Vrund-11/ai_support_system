import { Router, type Request, type Response, type NextFunction } from 'express';
import { AppError } from '@supportpilot/shared-lib';
import { presignUploadSchema, verifyUploadSchema } from '@supportpilot/validators';
import { requireAuth } from '../middleware/auth.middleware.js';
import { storageService } from '../services/storage.service.js';
import { validateFileSignature } from '../lib/magic-bytes.js';

export const uploadRouter: Router = Router();

// All upload endpoints require authenticated user with tenantId
uploadRouter.use(requireAuth);

/**
 * POST /api/v1/uploads/presign
 * Generate presigned S3 upload URL with 5 min expiry and tenant-isolated key.
 */
uploadRouter.post(
  '/presign',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = presignUploadSchema.safeParse(req.body);
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
 * POST /api/v1/uploads/verify
 * Verify an uploaded file via S3 range get and magic bytes (T-FILE-01).
 * Rejects spoofed extensions with 400 problem details.
 */
uploadRouter.post(
  '/verify',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = verifyUploadSchema.safeParse(req.body);
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

      const result = await storageService.verifyUploadedFile(
        tenantId,
        parsed.data.key,
        parsed.data.contentType,
      );

      res.status(200).json({
        verified: true,
        key: result.key,
        detectedMime: result.detectedMime,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/uploads/validate-direct
 * Directly validates a base64 buffer against declared contentType for testing and direct checks.
 */
uploadRouter.post('/validate-direct', (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { data, contentType } = req.body as { data?: string; contentType?: string };
    if (!data || !contentType) {
      res.status(400).json({
        type: 'https://supportpilot.dev/errors/validation',
        title: 'Validation Error',
        status: 400,
        detail: 'data (base64) and contentType are required',
      });
      return;
    }

    const buffer = Buffer.from(data, 'base64');
    const result = validateFileSignature(buffer, contentType);

    if (!result.valid) {
      res.status(400).json({
        type: 'https://supportpilot.dev/errors/spoofed-file',
        title: 'Spoofed File Extension Rejected',
        status: 400,
        detail: result.reason ?? 'File signature does not match declared MIME type',
      });
      return;
    }

    res.status(200).json({
      valid: true,
      detectedMime: result.detectedMime,
    });
  } catch (err) {
    next(err);
  }
});
