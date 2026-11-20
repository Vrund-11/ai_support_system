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
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const updateTicketSchema = z.object({
  version: z.number().int().positive('Version is required for optimistic concurrency'),
  status: ticketStatusSchema.optional(),
  priority: ticketPrioritySchema.optional(),
  assigneeId: z.string().nullable().optional(),
  tags: z.array(z.string().trim()).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

export const ticketFilterSchema = z.object({
  status: z.union([ticketStatusSchema, z.array(ticketStatusSchema)]).optional(),
  priority: z.union([ticketPrioritySchema, z.array(ticketPrioritySchema)]).optional(),
  assigneeId: z.string().optional(),
  tag: z.string().optional(),
  q: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type TicketFilterInput = z.infer<typeof ticketFilterSchema>;
