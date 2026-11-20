import { z } from 'zod';

export const registerTenantSchema = z.object({
  tenantName: z
    .string()
    .trim()
    .min(2, 'Tenant name must be at least 2 characters')
    .max(100, 'Tenant name cannot exceed 100 characters'),
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters'),
});

export type RegisterTenantInput = z.infer<typeof registerTenantSchema>;
