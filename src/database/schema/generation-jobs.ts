import { pgTable, uuid, text, integer, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users';
import { schemas } from './schemas';

export const generationJobStatusEnum = pgEnum('generation_job_status', [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

export const exportFormatEnum = pgEnum('export_format', [
  'SQL',
  'CSV',
  'JSON',
  'DIRECT_SEED',
]);

export const generationJobs = pgTable('generation_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  schemaId: uuid('schema_id').references(() => schemas.id, { onDelete: 'set null' }),
  // Denormalized — keeps display info even after schema deletion
  schemaName: text('schema_name').notNull(),
  status: generationJobStatusEnum('status').notNull().default('pending'),
  config: jsonb('config').notNull().$type<GenerationJobConfig>(),
  estimate: jsonb('estimate').$type<GenerationEstimate>(),
  rowsGenerated: integer('rows_generated').notNull().default(0),
  rowsEstimated: integer('rows_estimated').notNull().default(0),
  exportInfo: jsonb('export_info').$type<ExportInfo>(),
  errorInfo: jsonb('error_info').$type<ErrorInfo>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

// ── Embedded JSON types ────────────────────────────────────────────────────────

export interface GenerationJobConfig {
  schemaId: string;
  tableRowCounts: Record<string, number>;
  seed: number;
  batchSize: number;
  locale: string;
  exportFormat: 'SQL' | 'CSV' | 'JSON' | 'DIRECT_SEED';
  connectionId?: string;
}

export interface GenerationEstimate {
  totalRows: number;
  perTable: Record<string, number>;
  estimatedDurationMs: number;
  estimatedSizeBytes: number;
  insertOrder: string[];
}

export interface ExportInfo {
  format: 'SQL' | 'CSV' | 'JSON' | 'DIRECT_SEED';
  fileName: string;
  fileSizeBytes: number;
  // Virtual download URL served by GET /api/generation/jobs/:id/export
  downloadUrl: string;
  // Embedded content (MVP — production would use object storage)
  sql?: string;
  json?: Record<string, unknown[]>;
  csv?: Record<string, string>;
  directSeed?: {
    connectionId: string;
    tablesSeeded: string[];
    rowsInserted: number;
  };
}

export interface ErrorInfo {
  code: string;
  message: string;
  tableName?: string;
}

export type GenerationJob = typeof generationJobs.$inferSelect;
export type NewGenerationJob = typeof generationJobs.$inferInsert;
export type GenerationJobStatus = (typeof generationJobStatusEnum.enumValues)[number];
export type ExportFormat = (typeof exportFormatEnum.enumValues)[number];
