import { z } from 'zod';

export const createConnectionSchema = z.object({
  name: z.string().min(1).max(100),
  dialect: z.enum(['postgresql', 'mysql']).default('postgresql'),
  host: z.string().min(1).max(253),
  port: z.coerce.number().int().min(1).max(65535).default(5432),
  database: z.string().min(1).max(100),
  username: z.string().min(1).max(100),
  password: z.string().min(1),
  ssl: z.boolean().default(false),
});

export type CreateConnectionDto = z.infer<typeof createConnectionSchema>;
