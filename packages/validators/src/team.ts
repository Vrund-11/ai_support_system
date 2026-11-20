import { z } from 'zod';

export const inviteTeamMemberSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  name: z.string().trim().min(1, 'Name is required').max(150),
  role: z.enum(['OWNER', 'LEAD', 'AGENT', 'VIEWER']).default('AGENT'),
});

export type InviteTeamMemberInput = z.infer<typeof inviteTeamMemberSchema>;

export const updateNotificationPrefsSchema = z.object({
  email: z.boolean().optional(),
  push: z.boolean().optional(),
  inApp: z.boolean().optional(),
});

export type UpdateNotificationPrefsInput = z.infer<typeof updateNotificationPrefsSchema>;
