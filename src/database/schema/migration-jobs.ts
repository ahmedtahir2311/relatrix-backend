import { pgTable, uuid, text, integer, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users';
import { schemas } from './schemas';

export const migrationJobStatusEnum = pgEnum('migration_job_status', [
  'pending',
  'running',
  'completed',
  'failed',
]);

export const migrationFormatEnum = pgEnum('migration_format', ['SQL_FILE', 'DIRECT_APPLY']);

export const migrationModeEnum = pgEnum('migration_mode', ['safe', 'replace']);

export const migrationJobs = pgTable('migration_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  schemaId: uuid('schema_id').references(() => schemas.id, { onDelete: 'set null' }),
  // Denormalized for display after schema deletion
  schemaName: text('schema_name').notNull(),
  status: migrationJobStatusEnum('status').notNull().default('pending'),
  config: jsonb('config').notNull().$type<MigrationJobConfig>(),
  tablesApplied: integer('tables_applied').notNull().default(0),
  errorInfo: jsonb('error_info').$type<MigrationErrorInfo>(),
  exportInfo: jsonb('export_info').$type<MigrationExportInfo>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

// ── Embedded JSON types ────────────────────────────────────────────────────────

export interface MigrationJobConfig {
  schemaId: string;
  format: 'SQL_FILE' | 'DIRECT_APPLY';
  mode: 'safe' | 'replace';
  connectionId?: string;
}

export interface MigrationErrorInfo {
  message: string;
  tableName?: string;
}

export interface MigrationExportInfo {
  downloadUrl: string;
  fileName: string;
  fileSizeBytes: number;
}

export type MigrationJob = typeof migrationJobs.$inferSelect;
export type NewMigrationJob = typeof migrationJobs.$inferInsert;
export type MigrationJobStatus = (typeof migrationJobStatusEnum.enumValues)[number];
