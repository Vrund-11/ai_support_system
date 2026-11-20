import { z } from 'zod';

export const createCustomerSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  name: z.string().trim().min(1, 'Name is required').max(150),
  externalId: z.string().trim().optional(),
  visitorIds: z.array(z.string()).default([]),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const customerFilterSchema = z.object({
  q: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type CustomerFilterInput = z.infer<typeof customerFilterSchema>;
