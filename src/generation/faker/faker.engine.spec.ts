import { FakerEngine, topologicalSort, formatSQL, formatCSV } from './faker.engine';
import type { TableDef, RelationshipDef, GeneratedData } from './faker.engine';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCol(
  overrides: Partial<TableDef['columns'][number]> & { id: string; name: string; dataType: TableDef['columns'][number]['dataType'] },
): TableDef['columns'][number] {
  return {
    isPrimaryKey: false,
    isNullable: true,
    isUnique: false,
    isForeignKey: false,
    defaultValue: null,
    fakerProvider: null,
    position: 0,
    ...overrides,
  };
}

const USERS_TABLE: TableDef = {
  id: 'tbl-users',
  name: 'users',
  displayName: 'Users',
  columns: [
    makeCol({ id: 'col-u-id', name: 'id', dataType: 'UUID', isPrimaryKey: true, isNullable: false, isUnique: true }),
    makeCol({ id: 'col-u-email', name: 'email', dataType: 'VARCHAR', isNullable: false, isUnique: true }),
    makeCol({ id: 'col-u-name', name: 'name', dataType: 'TEXT' }),
  ],
};

const ORDERS_TABLE: TableDef = {
  id: 'tbl-orders',
  name: 'orders',
  displayName: 'Orders',
  columns: [
    makeCol({ id: 'col-o-id', name: 'id', dataType: 'SERIAL', isPrimaryKey: true, isNullable: false }),
    makeCol({ id: 'col-o-uid', name: 'user_id', dataType: 'UUID', isNullable: false, isForeignKey: true }),
    makeCol({ id: 'col-o-amt', name: 'amount', dataType: 'DECIMAL', isNullable: false }),
  ],
};

const FK_ORDERS_USERS: RelationshipDef = {
  sourceTableId: 'tbl-orders',
  sourceColumnId: 'col-o-uid',
  targetTableId: 'tbl-users',
  targetColumnId: 'col-u-id',
};

// ── FakerEngine ────────────────────────────────────────────────────────────────

describe('FakerEngine — basic generation', () => {
  let engine: FakerEngine;
  beforeEach(() => { engine = new FakerEngine(42); });

  it('generates the requested number of rows', () => {
    const allTables = new Map([['tbl-users', USERS_TABLE]]);
    const data: GeneratedData = new Map();
    const rows = engine.generateTable(USERS_TABLE, 10, allTables, data, []);
    expect(rows).toHaveLength(10);
  });

  it('generates all declared columns per row', () => {
    const allTables = new Map([['tbl-users', USERS_TABLE]]);
    const data: GeneratedData = new Map();
    const rows = engine.generateTable(USERS_TABLE, 3, allTables, data, []);
    for (const row of rows) {
      expect(Object.keys(row)).toEqual(USERS_TABLE.columns.map((c) => c.name));
    }
  });
});

describe('FakerEngine — UUID primary key', () => {
  it('generates valid UUIDs for UUID PK column', () => {
    const engine = new FakerEngine(1);
    const allTables = new Map([['tbl-users', USERS_TABLE]]);
    const rows = engine.generateTable(USERS_TABLE, 5, allTables, new Map(), []);
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (const row of rows) {
      expect(String(row['id'])).toMatch(uuidRe);
    }
  });

  it('generates unique UUIDs across rows', () => {
    const engine = new FakerEngine(2);
    const allTables = new Map([['tbl-users', USERS_TABLE]]);
    const rows = engine.generateTable(USERS_TABLE, 50, allTables, new Map(), []);
    const ids = rows.map((r) => r['id']);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('FakerEngine — SERIAL PK', () => {
  it('generates sequential integers starting at 1', () => {
    const engine = new FakerEngine(3);
    const allTables = new Map([
      ['tbl-users', USERS_TABLE],
      ['tbl-orders', ORDERS_TABLE],
    ]);
    const usersData = engine.generateTable(USERS_TABLE, 5, allTables, new Map(), []);
    const data: GeneratedData = new Map([['tbl-users', usersData]]);
    const rows = engine.generateTable(ORDERS_TABLE, 5, allTables, data, [FK_ORDERS_USERS]);
    const ids = rows.map((r) => r['id']);
    expect(ids).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('FakerEngine — FK resolution', () => {
  it('FK column values come from parent table', () => {
    const engine = new FakerEngine(4);
    const allTables = new Map([
      ['tbl-users', USERS_TABLE],
      ['tbl-orders', ORDERS_TABLE],
    ]);
    const usersData = engine.generateTable(USERS_TABLE, 5, allTables, new Map(), []);
    const parentIds = usersData.map((r) => r['id']);
    const data: GeneratedData = new Map([['tbl-users', usersData]]);
    const orders = engine.generateTable(ORDERS_TABLE, 10, allTables, data, [FK_ORDERS_USERS]);
    for (const row of orders) {
      expect(parentIds).toContain(row['user_id']);
    }
  });
});

describe('FakerEngine — seeded determinism', () => {
  it('same seed produces identical output', () => {
    const a = new FakerEngine(99);
    const b = new FakerEngine(99);
    const allTables = new Map([['tbl-users', USERS_TABLE]]);
    const rowsA = a.generateTable(USERS_TABLE, 5, allTables, new Map(), []);
    const rowsB = b.generateTable(USERS_TABLE, 5, allTables, new Map(), []);
    expect(rowsA).toEqual(rowsB);
  });
});

// ── topologicalSort ────────────────────────────────────────────────────────────

describe('topologicalSort', () => {
  it('puts independent tables in input order', () => {
    const tables = [USERS_TABLE, ORDERS_TABLE];
    // No relationships → stable relative order
    const sorted = topologicalSort(tables, []);
    expect(sorted.map((t) => t.id)).toEqual(['tbl-users', 'tbl-orders']);
  });

  it('places parent (users) before child (orders) when FK exists', () => {
    const tables = [ORDERS_TABLE, USERS_TABLE]; // reversed input
    const sorted = topologicalSort(tables, [FK_ORDERS_USERS]);
    const usersIdx = sorted.findIndex((t) => t.id === 'tbl-users');
    const ordersIdx = sorted.findIndex((t) => t.id === 'tbl-orders');
    expect(usersIdx).toBeLessThan(ordersIdx);
  });

  it('returns all tables even if no relationships', () => {
    const tables = [USERS_TABLE, ORDERS_TABLE];
    expect(topologicalSort(tables, [])).toHaveLength(2);
  });

  it('handles self-references without infinite loop', () => {
    const selfRef: RelationshipDef = {
      sourceTableId: 'tbl-users',
      sourceColumnId: 'col-u-id',
      targetTableId: 'tbl-users',
      targetColumnId: 'col-u-id',
    };
    expect(() => topologicalSort([USERS_TABLE], [selfRef])).not.toThrow();
  });
});

// ── formatSQL ──────────────────────────────────────────────────────────────────

describe('formatSQL', () => {
  it('generates INSERT statements with correct table and column names', () => {
    const data: GeneratedData = new Map([
      ['tbl-users', [{ id: 'abc-123', email: 'test@test.com', name: 'Alice' }]],
    ]);
    const sql = formatSQL([USERS_TABLE], data);
    expect(sql).toContain('INSERT INTO "users"');
    expect(sql).toContain('"id", "email", "name"');
    expect(sql).toContain("'abc-123'");
    expect(sql).toContain("'test@test.com'");
  });

  it('wraps output in BEGIN / COMMIT', () => {
    const data: GeneratedData = new Map([['tbl-users', [{ id: '1', email: 'a@b.com', name: null }]]]);
    const sql = formatSQL([USERS_TABLE], data);
    expect(sql).toMatch(/^-- Generated/m);
    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('COMMIT;');
  });

  it('renders NULL for null values', () => {
    const data: GeneratedData = new Map([['tbl-users', [{ id: '1', email: 'a@b.com', name: null }]]]);
    const sql = formatSQL([USERS_TABLE], data);
    expect(sql).toContain('NULL');
  });

  it('skips tables with zero rows', () => {
    const data: GeneratedData = new Map([['tbl-users', []]]);
    const sql = formatSQL([USERS_TABLE], data);
    expect(sql).not.toContain('INSERT INTO "users"');
  });
});

// ── formatCSV ──────────────────────────────────────────────────────────────────

describe('formatCSV', () => {
  it('generates header from column names', () => {
    const csv = formatCSV(USERS_TABLE, []);
    expect(csv).toBe('id,email,name');
  });

  it('generates one data row per object', () => {
    const rows = [
      { id: 'uuid-1', email: 'alice@example.com', name: 'Alice' },
      { id: 'uuid-2', email: 'bob@example.com', name: 'Bob' },
    ];
    const csv = formatCSV(USERS_TABLE, rows);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3); // header + 2 rows
    expect(lines[1]).toBe('uuid-1,alice@example.com,Alice');
  });

  it('quotes values containing commas', () => {
    const rows = [{ id: '1', email: 'a@b.com', name: 'Smith, John' }];
    const csv = formatCSV(USERS_TABLE, rows);
    expect(csv).toContain('"Smith, John"');
  });

  it('renders empty string for null values', () => {
    const rows = [{ id: '1', email: 'a@b.com', name: null }];
    const csv = formatCSV(USERS_TABLE, rows);
    const lastField = csv.split('\n')[1].split(',')[2];
    expect(lastField).toBe('');
  });
});
