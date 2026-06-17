import { pgTable, uuid, text, boolean, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { tables } from './tables';

export const dataTypeEnum = pgEnum('data_type', [
  'VARCHAR',
  'TEXT',
  'INTEGER',
  'BIGINT',
  'DECIMAL',
  'BOOLEAN',
  'TIMESTAMP',
  'DATE',
  'UUID',
  'SERIAL',
  'JSON',
]);

export const columns = pgTable('columns', {
  id: uuid('id').primaryKey().defaultRandom(),
  tableId: uuid('table_id')
    .notNull()
    .references(() => tables.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  dataType: dataTypeEnum('data_type').notNull().default('TEXT'),
  isPrimaryKey: boolean('is_primary_key').notNull().default(false),
  isNullable: boolean('is_nullable').notNull().default(true),
  isUnique: boolean('is_unique').notNull().default(false),
  isForeignKey: boolean('is_foreign_key').notNull().default(false),
  defaultValue: text('default_value'),
  fakerProvider: text('faker_provider'),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Column = typeof columns.$inferSelect;
export type NewColumn = typeof columns.$inferInsert;
export type DataType = (typeof dataTypeEnum.enumValues)[number];
