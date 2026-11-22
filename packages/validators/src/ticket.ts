import { z } from 'zod';

export const ticketStatusSchema = z.enum([
  'NEW',
  'OPEN',
  'PENDING_CUSTOMER',
  'ON_HOLD',
  'RESOLVED',
  'CLOSED',
]);

export const ticketPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3, 'Subject must be at least 3 characters').max(250),
  description: z.string().trim().min(5, 'Description must be at least 5 characters').max(10000),
  customerId: z.string().min(1, 'CustomerId is required'),
  priority: ticketPrioritySchema.default('MEDIUM'),
  assigneeId: z.string().optional(),
  tags: z.array(z.string().trim()).default([]),
  attachments: z
    .array(
      z.object({
        key: z.string().min(1, 'Attachment key required'),
        name: z.string().min(1, 'Attachment name required'),
        size: z.number().int().nonnegative('Attachment size must be non-negative'),
        mime: z.string().min(1, 'Attachment mime required'),
      }),
    )
    .default([]),
  customFields: z.record(z.string(), z.unknown()).default({}),
  linkedTicketIds: z.array(z.string()).default([]),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const updateTicketSchema = z.object({
  version: z.number().int().positive('Version is required for optimistic concurrency'),
  status: ticketStatusSchema.optional(),
  priority: ticketPrioritySchema.optional(),
  assigneeId: z.string().nullable().optional(),
  tags: z.array(z.string().trim()).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  linkedTicketIds: z.array(z.string()).optional(),
});

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

export const bulkTicketActionSchema = z.object({
  ticketIds: z.array(z.string().min(1)).min(1, 'At least one ticket ID required'),
  action: z.enum(['ASSIGN', 'TAG', 'STATUS']),
  value: z.union([z.string(), z.array(z.string()), z.null()]),
});

export type BulkTicketActionInput = z.infer<typeof bulkTicketActionSchema>;

export const ticketFilterSchema = z.object({
  status: z.union([ticketStatusSchema, z.array(ticketStatusSchema)]).optional(),
  priority: z.union([ticketPrioritySchema, z.array(ticketPrioritySchema)]).optional(),
  assigneeId: z.string().optional(),
  assignedAgentId: z.string().optional(),
  tag: z.string().optional(),
  q: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type TicketFilterInput = z.infer<typeof ticketFilterSchema>;
