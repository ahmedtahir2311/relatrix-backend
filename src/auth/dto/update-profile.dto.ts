import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email('Invalid email address').optional(),
  avatarUrl: z.string().url('Invalid URL').optional().nullable(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'At least one field must be provided' },
);

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
