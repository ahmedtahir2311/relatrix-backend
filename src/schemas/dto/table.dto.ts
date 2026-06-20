import { z } from 'zod';

export const createTableSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z_][a-z0-9_]*$/i, 'Must be a valid SQL identifier'),
  displayName: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
});

export const updateTableSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z_][a-z0-9_]*$/i).optional(),
  displayName: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});

export type CreateTableDto = z.infer<typeof createTableSchema>;
export type UpdateTableDto = z.infer<typeof updateTableSchema>;
