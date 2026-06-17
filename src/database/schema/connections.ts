import { pgTable, uuid, text, integer, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users';

export const dbDialectEnum = pgEnum('db_dialect', ['postgresql', 'mysql']);

export const connectionStatusEnum = pgEnum('connection_status', ['untested', 'ok', 'failed']);

export const dbConnections = pgTable('db_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  dialect: dbDialectEnum('dialect').notNull().default('postgresql'),
  host: text('host').notNull(),
  port: integer('port').notNull().default(5432),
  database: text('database').notNull(),
  username: text('username').notNull(),
  passwordEncrypted: text('password_encrypted').notNull(),
  ssl: boolean('ssl').notNull().default(false),
  status: connectionStatusEnum('status').notNull().default('untested'),
  lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type DbConnection = typeof dbConnections.$inferSelect;
export type NewDbConnection = typeof dbConnections.$inferInsert;
export type DbDialect = (typeof dbDialectEnum.enumValues)[number];
export type ConnectionStatus = (typeof connectionStatusEnum.enumValues)[number];
