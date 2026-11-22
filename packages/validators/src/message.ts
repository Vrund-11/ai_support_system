import { z } from 'zod';

export const attachmentSchema = z.object({
  key: z.string().min(1, 'Attachment key required'),
  name: z.string().min(1, 'Attachment name required'),
  size: z.number().int().nonnegative('Attachment size must be non-negative'),
  mime: z.string().min(1, 'Attachment mime required'),
});

export const createMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message body cannot be empty').max(10000),
  isInternal: z.boolean().default(false),
  attachments: z.array(attachmentSchema).default([]),
  clientId: z.string().uuid().optional(),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
