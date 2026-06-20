import { z } from 'zod';

export const createSchemaSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z_][a-z0-9_]*$/i, 'Must be a valid SQL identifier'),
  description: z.string().max(500).optional().nullable(),
});

export const updateSchemaSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z_][a-z0-9_]*$/i).optional(),
  description: z.string().max(500).optional().nullable(),
}).refine((d) => Object.values(d).some((v) => v !== undefined), {
  message: 'At least one field must be provided',
});

export const querySchemasSchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

export type CreateSchemaDto = z.infer<typeof createSchemaSchema>;
export type UpdateSchemaDto = z.infer<typeof updateSchemaSchema>;
export type QuerySchemasDto = z.infer<typeof querySchemasSchema>;
