import { z } from 'zod';

export const startGenerationSchema = z
  .object({
    schemaId: z.string().uuid('Invalid schema ID'),
    // tableId → row count; tables not listed use batchSize
    tableRowCounts: z.record(z.string().uuid(), z.number().int().min(1).max(10_000)).default({}),
    batchSize: z.number().int().min(1).max(10_000).default(10),
    exportFormat: z.enum(['SQL', 'CSV', 'JSON', 'DIRECT_SEED']).default('SQL'),
    connectionId: z.string().uuid().optional(),
    locale: z.string().default('en'),
    seed: z.number().int().optional(),
  })
  .refine(
    (d) => d.exportFormat !== 'DIRECT_SEED' || !!d.connectionId,
    { message: 'connectionId is required when exportFormat is DIRECT_SEED', path: ['connectionId'] },
  );

export type StartGenerationDto = z.infer<typeof startGenerationSchema>;
