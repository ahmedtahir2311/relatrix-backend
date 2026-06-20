import { buildPostgresSQL } from './postgres.builder';
import type { TableDef, RelationshipDef } from './types';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const USERS: TableDef = {
  id: 'tbl-users',
  name: 'users',
  displayName: 'Users',
  columns: [
    { id: 'col-u-id', name: 'id', dataType: 'UUID', isPrimaryKey: true, isNullable: false, isUnique: false, isForeignKey: false, defaultValue: null },
    { id: 'col-u-email', name: 'email', dataType: 'VARCHAR', isPrimaryKey: false, isNullable: false, isUnique: true, isForeignKey: false, defaultValue: null },
    { id: 'col-u-name', name: 'name', dataType: 'TEXT', isPrimaryKey: false, isNullable: true, isUnique: false, isForeignKey: false, defaultValue: null },
    { id: 'col-u-ts', name: 'created_at', dataType: 'TIMESTAMP', isPrimaryKey: false, isNullable: false, isUnique: false, isForeignKey: false, defaultValue: null },
  ],
};

const ORDERS: TableDef = {
  id: 'tbl-orders',
  name: 'orders',
  displayName: 'Orders',
  columns: [
    { id: 'col-o-id', name: 'id', dataType: 'UUID', isPrimaryKey: true, isNullable: false, isUnique: false, isForeignKey: false, defaultValue: null },
    { id: 'col-o-uid', name: 'user_id', dataType: 'UUID', isPrimaryKey: false, isNullable: false, isUnique: false, isForeignKey: true, defaultValue: null },
    { id: 'col-o-total', name: 'total', dataType: 'DECIMAL', isPrimaryKey: false, isNullable: false, isUnique: false, isForeignKey: false, defaultValue: null },
    { id: 'col-o-cnt', name: 'count', dataType: 'INTEGER', isPrimaryKey: false, isNullable: true, isUnique: false, isForeignKey: false, defaultValue: '0' },
  ],
};

const FK_ORDERS_USERS: RelationshipDef = {
  id: 'rel-1',
  sourceTableId: 'tbl-orders',
  sourceColumnId: 'col-o-uid',
  targetTableId: 'tbl-users',
  targetColumnId: 'col-u-id',
  onDelete: 'CASCADE',
};

const SAFE_OPTS = { mode: 'safe' as const, schemaName: 'TestSchema', dialect: 'postgresql' as const };
const REPLACE_OPTS = { ...SAFE_OPTS, mode: 'replace' as const };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildPostgresSQL — safe mode', () => {
  let sql: string;
  beforeAll(() => { sql = buildPostgresSQL([USERS, ORDERS], [FK_ORDERS_USERS], SAFE_OPTS); });

  it('includes header with schema name and dialect', () => {
    expect(sql).toContain('-- Schema: TestSchema');
    expect(sql).toContain('-- Dialect: PostgreSQL');
  });

  it('uses CREATE TABLE IF NOT EXISTS', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "users"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "orders"');
  });

  it('does NOT drop tables', () => {
    expect(sql).not.toContain('DROP TABLE');
  });

  it('generates DEFAULT gen_random_uuid() for UUID PK', () => {
    expect(sql).toContain('"id" UUID NOT NULL DEFAULT gen_random_uuid()');
  });

  it('generates DEFAULT NOW() for TIMESTAMP column', () => {
    expect(sql).toContain('"created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()');
  });

  it('generates numeric raw default', () => {
    expect(sql).toContain('"count" INTEGER DEFAULT 0');
  });

  it('marks non-nullable columns as NOT NULL', () => {
    expect(sql).toContain('"email" VARCHAR(255) NOT NULL');
  });

  it('omits NOT NULL for nullable columns', () => {
    expect(sql).not.toContain('"name" TEXT NOT NULL');
  });

  it('generates PRIMARY KEY constraint', () => {
    expect(sql).toContain('CONSTRAINT "pk_users" PRIMARY KEY ("id")');
  });

  it('generates UNIQUE constraint for unique non-PK column', () => {
    expect(sql).toContain('CONSTRAINT "uq_users_email" UNIQUE ("email")');
  });

  it('generates FK as ALTER TABLE, not inline', () => {
    expect(sql).toContain('ALTER TABLE "orders"');
    expect(sql).toContain('FOREIGN KEY ("user_id") REFERENCES "users" ("id")');
    expect(sql).toContain('ON DELETE CASCADE');
  });

  it('generates index for FK column', () => {
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_orders_user_id" ON "orders" ("user_id")');
  });

  it('puts referenced table (users) before referencing table (orders) in output', () => {
    expect(sql.indexOf('"users"')).toBeLessThan(sql.indexOf('"orders"'));
  });
});

describe('buildPostgresSQL — replace mode', () => {
  let sql: string;
  beforeAll(() => { sql = buildPostgresSQL([USERS, ORDERS], [FK_ORDERS_USERS], REPLACE_OPTS); });

  it('uses CREATE TABLE without IF NOT EXISTS', () => {
    expect(sql).toContain('CREATE TABLE "users"');
    expect(sql).not.toContain('CREATE TABLE IF NOT EXISTS');
  });

  it('drops tables with CASCADE in reverse order', () => {
    expect(sql).toContain('DROP TABLE IF EXISTS "orders" CASCADE');
    expect(sql).toContain('DROP TABLE IF EXISTS "users" CASCADE');
    // orders (child) must be dropped before users (parent) to respect FK deps
    expect(sql.indexOf('DROP TABLE IF EXISTS "orders"')).toBeLessThan(
      sql.indexOf('DROP TABLE IF EXISTS "users"'),
    );
  });
});

describe('buildPostgresSQL — type mapping', () => {
  function sqlForType(dataType: TableDef['columns'][number]['dataType']): string {
    const t: TableDef = {
      id: 't1', name: 'test', displayName: 'Test',
      columns: [{ id: 'c1', name: 'col', dataType, isPrimaryKey: false, isNullable: true, isUnique: false, isForeignKey: false, defaultValue: null }],
    };
    return buildPostgresSQL([t], [], SAFE_OPTS);
  }

  it.each([
    ['VARCHAR', 'VARCHAR(255)'],
    ['TEXT', 'TEXT'],
    ['INTEGER', 'INTEGER'],
    ['BIGINT', 'BIGINT'],
    ['DECIMAL', 'DECIMAL(10,2)'],
    ['BOOLEAN', 'BOOLEAN'],
    ['DATE', 'DATE'],
    ['UUID', 'UUID'],
    ['JSON', 'JSONB'],
  ] as const)('%s → %s', (input, expected) => {
    expect(sqlForType(input)).toContain(expected);
  });

  it('SERIAL generates SERIAL NOT NULL (no separate DEFAULT)', () => {
    const s = sqlForType('SERIAL');
    expect(s).toContain('"col" SERIAL NOT NULL');
    expect(s).not.toContain('DEFAULT');
  });
});

describe('buildPostgresSQL — ON DELETE actions', () => {
  function sqlForOnDelete(action: RelationshipDef['onDelete']): string {
    return buildPostgresSQL([USERS, ORDERS], [{ ...FK_ORDERS_USERS, onDelete: action }], SAFE_OPTS);
  }

  it.each([
    ['CASCADE', 'ON DELETE CASCADE'],
    ['SET_NULL', 'ON DELETE SET NULL'],
    ['RESTRICT', 'ON DELETE RESTRICT'],
    ['NO_ACTION', 'ON DELETE NO ACTION'],
  ] as const)('%s → %s', (action, expected) => {
    expect(sqlForOnDelete(action)).toContain(expected);
  });
});
