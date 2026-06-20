import { z } from 'zod';

export const updateConnectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  host: z.string().min(1).max(253).optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  database: z.string().min(1).max(100).optional(),
  username: z.string().min(1).max(100).optional(),
  password: z.string().min(1).optional(),
  ssl: z.boolean().optional(),
});

export type UpdateConnectionDto = z.infer<typeof updateConnectionSchema>;
