import { z } from 'zod';

const DATA_TYPES = ['VARCHAR', 'TEXT', 'INTEGER', 'BIGINT', 'DECIMAL', 'BOOLEAN', 'TIMESTAMP', 'DATE', 'UUID', 'SERIAL', 'JSON'] as const;

export const createColumnSchema = z.object({
  tableId: z.string().uuid('Invalid table ID'),
  name: z.string().min(1).max(100).regex(/^[a-z_][a-z0-9_]*$/i, 'Must be a valid SQL identifier'),
  dataType: z.enum(DATA_TYPES).default('TEXT'),
  isPrimaryKey: z.boolean().default(false),
  isNullable: z.boolean().default(true),
  isUnique: z.boolean().default(false),
  isForeignKey: z.boolean().default(false),
  defaultValue: z.string().max(500).optional().nullable(),
  fakerProvider: z.string().max(100).optional().nullable(),
  position: z.number().int().min(0).default(0),
});

export const updateColumnSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z_][a-z0-9_]*$/i).optional(),
  dataType: z.enum(DATA_TYPES).optional(),
  isPrimaryKey: z.boolean().optional(),
  isNullable: z.boolean().optional(),
  isUnique: z.boolean().optional(),
  isForeignKey: z.boolean().optional(),
  defaultValue: z.string().max(500).optional().nullable(),
  fakerProvider: z.string().max(100).optional().nullable(),
  position: z.number().int().min(0).optional(),
});

export type CreateColumnDto = z.infer<typeof createColumnSchema>;
export type UpdateColumnDto = z.infer<typeof updateColumnSchema>;
