import { buildMysqlSQL } from './mysql.builder';
import type { TableDef, RelationshipDef } from './types';

const USERS: TableDef = {
  id: 'tbl-users',
  name: 'users',
  displayName: 'Users',
  columns: [
    { id: 'col-u-id', name: 'id', dataType: 'UUID', isPrimaryKey: true, isNullable: false, isUnique: false, isForeignKey: false, defaultValue: null },
    { id: 'col-u-email', name: 'email', dataType: 'VARCHAR', isPrimaryKey: false, isNullable: false, isUnique: true, isForeignKey: false, defaultValue: null },
    { id: 'col-u-active', name: 'active', dataType: 'BOOLEAN', isPrimaryKey: false, isNullable: false, isUnique: false, isForeignKey: false, defaultValue: null },
  ],
};

const POSTS: TableDef = {
  id: 'tbl-posts',
  name: 'posts',
  displayName: 'Posts',
  columns: [
    { id: 'col-p-id', name: 'id', dataType: 'SERIAL', isPrimaryKey: true, isNullable: false, isUnique: false, isForeignKey: false, defaultValue: null },
    { id: 'col-p-uid', name: 'user_id', dataType: 'UUID', isPrimaryKey: false, isNullable: false, isUnique: false, isForeignKey: true, defaultValue: null },
  ],
};

const FK: RelationshipDef = {
  id: 'rel-1',
  sourceTableId: 'tbl-posts',
  sourceColumnId: 'col-p-uid',
  targetTableId: 'tbl-users',
  targetColumnId: 'col-u-id',
  onDelete: 'NO_ACTION',
};

const SAFE_OPTS = { mode: 'safe' as const, schemaName: 'Blog', dialect: 'mysql' as const };
const REPLACE_OPTS = { ...SAFE_OPTS, mode: 'replace' as const };

describe('buildMysqlSQL — safe mode', () => {
  let sql: string;
  beforeAll(() => { sql = buildMysqlSQL([USERS, POSTS], [FK], SAFE_OPTS); });

  it('uses backtick quoting', () => {
    expect(sql).toContain('`users`');
    expect(sql).toContain('`id`');
  });

  it('does not use double-quote quoting', () => {
    expect(sql).not.toMatch(/"users"/);
  });

  it('appends ENGINE=InnoDB and charset footer', () => {
    expect(sql).toContain('ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
  });

  it('generates CREATE TABLE IF NOT EXISTS in safe mode', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS `users`');
  });

  it('maps SERIAL to INT AUTO_INCREMENT', () => {
    expect(sql).toContain('`id` INT NOT NULL AUTO_INCREMENT');
  });

  it('maps UUID to VARCHAR(36)', () => {
    expect(sql).toContain('`id` VARCHAR(36) NOT NULL');
  });

  it('generates FK as ALTER TABLE', () => {
    expect(sql).toContain('ALTER TABLE `posts`');
    expect(sql).toContain('FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)');
  });

  it('does not include IF NOT EXISTS in replace mode DROP (no FOREIGN_KEY_CHECKS in safe mode)', () => {
    expect(sql).not.toContain('FOREIGN_KEY_CHECKS');
  });
});

describe('buildMysqlSQL — replace mode', () => {
  let sql: string;
  beforeAll(() => { sql = buildMysqlSQL([USERS, POSTS], [FK], REPLACE_OPTS); });

  it('wraps DROPs with FOREIGN_KEY_CHECKS', () => {
    const checksOff = sql.indexOf('SET FOREIGN_KEY_CHECKS = 0');
    const drop = sql.indexOf('DROP TABLE IF EXISTS');
    const checksOn = sql.indexOf('SET FOREIGN_KEY_CHECKS = 1');
    expect(checksOff).toBeLessThan(drop);
    expect(drop).toBeLessThan(checksOn);
  });

  it('drops tables without CASCADE (uses FOREIGN_KEY_CHECKS instead)', () => {
    expect(sql).toContain('DROP TABLE IF EXISTS `posts`');
    expect(sql).not.toContain('CASCADE');
  });

  it('uses CREATE TABLE without IF NOT EXISTS in replace mode', () => {
    expect(sql).not.toContain('CREATE TABLE IF NOT EXISTS');
  });
});

describe('buildMysqlSQL — type mapping', () => {
  function sqlForType(dataType: TableDef['columns'][number]['dataType']): string {
    const t: TableDef = {
      id: 't1', name: 'tbl', displayName: 'T',
      columns: [{ id: 'c1', name: 'col', dataType, isPrimaryKey: false, isNullable: true, isUnique: false, isForeignKey: false, defaultValue: null }],
    };
    return buildMysqlSQL([t], [], SAFE_OPTS);
  }

  it.each([
    ['VARCHAR', 'VARCHAR(255)'],
    ['TEXT', 'TEXT'],
    ['INTEGER', 'INT'],
    ['BIGINT', 'BIGINT'],
    ['DECIMAL', 'DECIMAL(10,2)'],
    ['BOOLEAN', 'BOOLEAN'],
    ['TIMESTAMP', 'DATETIME'],
    ['DATE', 'DATE'],
    ['UUID', 'VARCHAR(36)'],
    ['JSON', 'JSON'],
  ] as const)('%s → %s', (input, expected) => {
    expect(sqlForType(input)).toContain(expected);
  });
});
