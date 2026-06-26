import { z } from 'zod';

export const probeConnectionSchema = z.object({
  dialect: z.enum(['postgresql', 'mysql']).default('postgresql'),
  host: z.string().min(1).max(253),
  port: z.coerce.number().int().min(1).max(65535),
  database: z.string().min(1).max(100),
  username: z.string().min(1).max(100),
  password: z.string().min(1),
  ssl: z.boolean().default(false),
});

export type ProbeConnectionDto = z.infer<typeof probeConnectionSchema>;
