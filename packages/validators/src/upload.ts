import { z } from 'zod';

export const presignUploadSchema = z.object({
  filename: z.string().trim().min(1, 'Filename required').max(255),
  contentType: z.string().trim().min(1, 'ContentType required').max(100),
  size: z
    .number()
    .int()
    .positive('Size must be positive')
    .max(50 * 1024 * 1024, 'Maximum file size is 50MB'),
  purpose: z.enum(['attachment', 'kb_document']).default('attachment'),
});

export type PresignUploadInput = z.infer<typeof presignUploadSchema>;

export const verifyUploadSchema = z.object({
  key: z.string().trim().min(1, 'S3 key required'),
  contentType: z.string().trim().min(1, 'ContentType required'),
});

export type VerifyUploadInput = z.infer<typeof verifyUploadSchema>;

export const registerKbDocumentSchema = z.object({
  title: z.string().trim().min(1, 'Document title required').max(255),
  source: z.enum(['upload', 'paste', 'url', 'manual']),
  key: z.string().optional(),
  content: z.string().optional(),
  contentType: z.string().default('application/pdf'),
});

export type RegisterKbDocumentInput = z.infer<typeof registerKbDocumentSchema>;
