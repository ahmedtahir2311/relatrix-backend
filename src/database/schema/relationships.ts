import { pgTable, uuid, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { schemas } from './schemas';
import { tables } from './tables';
import { columns } from './columns';

export const relationshipTypeEnum = pgEnum('relationship_type', [
  'ONE_TO_ONE',
  'ONE_TO_MANY',
  'MANY_TO_MANY',
]);

export const onDeleteActionEnum = pgEnum('on_delete_action', [
  'CASCADE',
  'SET_NULL',
  'RESTRICT',
  'NO_ACTION',
]);

export const relationships = pgTable('relationships', {
  id: uuid('id').primaryKey().defaultRandom(),
  schemaId: uuid('schema_id')
    .notNull()
    .references(() => schemas.id, { onDelete: 'cascade' }),
  sourceTableId: uuid('source_table_id')
    .notNull()
    .references(() => tables.id, { onDelete: 'cascade' }),
  sourceColumnId: uuid('source_column_id')
    .notNull()
    .references(() => columns.id, { onDelete: 'cascade' }),
  targetTableId: uuid('target_table_id')
    .notNull()
    .references(() => tables.id, { onDelete: 'cascade' }),
  targetColumnId: uuid('target_column_id')
    .notNull()
    .references(() => columns.id, { onDelete: 'cascade' }),
  relationshipType: relationshipTypeEnum('relationship_type').notNull().default('ONE_TO_MANY'),
  minCardinality: integer('min_cardinality').notNull().default(0),
  maxCardinality: integer('max_cardinality').notNull().default(1),
  onDelete: onDeleteActionEnum('on_delete').notNull().default('NO_ACTION'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Relationship = typeof relationships.$inferSelect;
export type NewRelationship = typeof relationships.$inferInsert;
export type RelationshipType = (typeof relationshipTypeEnum.enumValues)[number];
export type OnDeleteAction = (typeof onDeleteActionEnum.enumValues)[number];
