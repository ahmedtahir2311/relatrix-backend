export * from './users';
export * from './password-reset-tokens';
export * from './schemas';
export * from './tables';
export * from './columns';
export * from './relationships';
export * from './connections';
export * from './generation-jobs';
export * from './migration-jobs';

// ── Drizzle relational query API ─────────────────────────────────────────────
import { relations } from 'drizzle-orm';
import { users } from './users';
import { passwordResetTokens } from './password-reset-tokens';
import { schemas } from './schemas';
import { tables } from './tables';
import { columns } from './columns';
import { relationships } from './relationships';
import { dbConnections } from './connections';
import { generationJobs } from './generation-jobs';
import { migrationJobs } from './migration-jobs';

export const usersRelations = relations(users, ({ many }) => ({
  schemas: many(schemas),
  dbConnections: many(dbConnections),
  generationJobs: many(generationJobs),
  migrationJobs: many(migrationJobs),
  passwordResetTokens: many(passwordResetTokens),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}));

export const schemasRelations = relations(schemas, ({ one, many }) => ({
  user: one(users, { fields: [schemas.userId], references: [users.id] }),
  tables: many(tables),
  relationships: many(relationships),
  generationJobs: many(generationJobs),
  migrationJobs: many(migrationJobs),
}));

export const tablesRelations = relations(tables, ({ one, many }) => ({
  schema: one(schemas, { fields: [tables.schemaId], references: [schemas.id] }),
  columns: many(columns),
}));

export const columnsRelations = relations(columns, ({ one }) => ({
  table: one(tables, { fields: [columns.tableId], references: [tables.id] }),
}));

export const relationshipsRelations = relations(relationships, ({ one }) => ({
  schema: one(schemas, { fields: [relationships.schemaId], references: [schemas.id] }),
  sourceTable: one(tables, {
    fields: [relationships.sourceTableId],
    references: [tables.id],
    relationName: 'sourceRelationships',
  }),
  sourceColumn: one(columns, {
    fields: [relationships.sourceColumnId],
    references: [columns.id],
    relationName: 'sourceColumnRelationships',
  }),
  targetTable: one(tables, {
    fields: [relationships.targetTableId],
    references: [tables.id],
    relationName: 'targetRelationships',
  }),
  targetColumn: one(columns, {
    fields: [relationships.targetColumnId],
    references: [columns.id],
    relationName: 'targetColumnRelationships',
  }),
}));

export const dbConnectionsRelations = relations(dbConnections, ({ one }) => ({
  user: one(users, { fields: [dbConnections.userId], references: [users.id] }),
}));

export const generationJobsRelations = relations(generationJobs, ({ one }) => ({
  user: one(users, { fields: [generationJobs.userId], references: [users.id] }),
  schema: one(schemas, { fields: [generationJobs.schemaId], references: [schemas.id] }),
}));

export const migrationJobsRelations = relations(migrationJobs, ({ one }) => ({
  user: one(users, { fields: [migrationJobs.userId], references: [users.id] }),
  schema: one(schemas, { fields: [migrationJobs.schemaId], references: [schemas.id] }),
}));
