import crypto from 'node:crypto';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppError } from '@supportpilot/shared-lib';
import type { PresignUploadInput } from '@supportpilot/validators';
import { getS3Client, getS3BucketName } from '../lib/s3.js';
import { validateFileSignature } from '../lib/magic-bytes.js';

export interface PresignedUploadResult {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

export interface VerifyResult {
  valid: boolean;
  key: string;
  detectedMime: string | null;
}

export class StorageService {
  /**
   * Generate an S3 presigned PUT URL for upload with 5 min (300s) expiry.
   * Ensures strict tenant isolation: key is prefixed with tenantId.
   */
  async generatePresignedUpload(
    tenantId: string,
    input: PresignUploadInput,
  ): Promise<PresignedUploadResult> {
    if (!tenantId) {
      throw new AppError(400, 'Tenant ID is required for uploads', '/errors/missing-tenant');
    }

    const s3 = getS3Client();
    const bucket = getS3BucketName();

    // Sanitize filename: remove directory traversal and control characters
    const safeFilename = input.filename
      .replace(/\.\.+/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/^\.+/, '');
    const fileId = crypto.randomUUID();
    const key = `${tenantId}/${input.purpose}/${fileId}-${safeFilename}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: input.contentType,
    });

    // 5-minute expiry (300 seconds) per PRD KB-1
    const expiresIn = 300;
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn });

    return {
      uploadUrl,
      key,
      expiresIn,
    };
  }

  /**
   * Verify an uploaded file by checking its magic bytes against declared MIME.
   * Strictly enforces cross-tenant access prevention.
   */
  async verifyUploadedFile(
    tenantId: string,
    key: string,
    declaredMime: string,
  ): Promise<VerifyResult> {
    if (!tenantId) {
      throw new AppError(400, 'Tenant ID is required', '/errors/missing-tenant');
    }

    // Strict tenant isolation: key MUST start with tenantId/
    if (!key.startsWith(`${tenantId}/`)) {
      throw new AppError(403, 'Cross-tenant file access forbidden', '/errors/cross-tenant-access');
    }

    const s3 = getS3Client();
    const bucket = getS3BucketName();

    let buffer: Buffer;
    try {
      // Range get first 512 bytes for file signature detection
      const getCommand = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        Range: 'bytes=0-511',
      });
      const response = await s3.send(getCommand);
      if (!response.Body) {
        throw new AppError(400, 'File content not found in storage', '/errors/file-not-found');
      }

      // Convert stream to Buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      buffer = Buffer.concat(chunks);
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        400,
        `Failed to retrieve file header from storage: ${(err as Error).message}`,
        '/errors/file-retrieval-failed',
      );
    }

    const result = validateFileSignature(buffer, declaredMime);
    if (!result.valid) {
      throw new AppError(400, 'Spoofed File Extension Rejected', '/errors/spoofed-file', {
        detail: result.reason ?? 'File signature does not match declared MIME type',
      });
    }

    return {
      valid: true,
      key,
      detectedMime: result.detectedMime,
    };
  }
}

export const storageService = new StorageService();
