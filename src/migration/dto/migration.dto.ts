import { z } from 'zod';

export const previewMigrationSchema = z.object({
  schemaId: z.string().uuid(),
  dialect: z.enum(['postgresql', 'mysql']).default('postgresql'),
  mode: z.enum(['safe', 'replace']).default('safe'),
});

export const createMigrationJobSchema = z
  .object({
    schemaId: z.string().uuid(),
    format: z.enum(['SQL_FILE', 'DIRECT_APPLY']).default('SQL_FILE'),
    mode: z.enum(['safe', 'replace']).default('safe'),
    // Required for SQL_FILE (no connection); inferred from connection for DIRECT_APPLY
    dialect: z.enum(['postgresql', 'mysql']).optional(),
    connectionId: z.string().uuid().optional(),
  })
  .refine(
    (d) => d.format !== 'DIRECT_APPLY' || !!d.connectionId,
    { message: 'connectionId is required for DIRECT_APPLY', path: ['connectionId'] },
  )
  .refine(
    (d) => d.format !== 'SQL_FILE' || !!d.dialect,
    { message: 'dialect is required for SQL_FILE format', path: ['dialect'] },
  );

export type PreviewMigrationDto = z.infer<typeof previewMigrationSchema>;
export type CreateMigrationJobDto = z.infer<typeof createMigrationJobSchema>;
