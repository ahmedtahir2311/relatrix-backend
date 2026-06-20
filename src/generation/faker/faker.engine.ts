import { Faker, en } from '@faker-js/faker';
import { valueFromNamePattern, callFakerProvider } from './provider-map';

// Mirror of the Drizzle column/table/relationship types (loose — no DB import needed)
export interface ColumnDef {
  id: string;
  name: string;
  dataType: 'VARCHAR' | 'TEXT' | 'INTEGER' | 'BIGINT' | 'DECIMAL' | 'BOOLEAN' | 'TIMESTAMP' | 'DATE' | 'UUID' | 'SERIAL' | 'JSON';
  isPrimaryKey: boolean;
  isNullable: boolean;
  isUnique: boolean;
  isForeignKey: boolean;
  defaultValue: string | null;
  fakerProvider: string | null;
  position: number;
}

export interface TableDef {
  id: string;
  name: string;
  displayName: string;
  columns: ColumnDef[];
}

export interface RelationshipDef {
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
}

export type GeneratedData = Map<string, Array<Record<string, unknown>>>;

export class FakerEngine {
  private readonly faker: Faker;

  constructor(seed?: number) {
    this.faker = new Faker({ locale: [en] });
    if (seed !== undefined) this.faker.seed(seed);
  }

  generateTable(
    table: TableDef,
    count: number,
    allTables: Map<string, TableDef>,
    generatedData: GeneratedData,
    relationships: RelationshipDef[],
  ): Array<Record<string, unknown>> {
    const fkMappings = relationships
      .filter((r) => r.sourceTableId === table.id)
      .map((r) => ({ columnId: r.sourceColumnId, targetTableId: r.targetTableId, targetColumnId: r.targetColumnId }));

    // Track unique values per unique column (columnId → set of used values)
    const usedValues = new Map<string, Set<unknown>>();
    for (const col of table.columns) {
      if (col.isPrimaryKey || col.isUnique) usedValues.set(col.id, new Set());
    }

    const rows: Array<Record<string, unknown>> = [];

    for (let i = 0; i < count; i++) {
      const row: Record<string, unknown> = {};

      for (const col of table.columns) {
        row[col.name] = this.generateValue(col, i, fkMappings, allTables, generatedData, usedValues);
      }

      rows.push(row);
    }

    return rows;
  }

  private generateValue(
    col: ColumnDef,
    rowIndex: number,
    fkMappings: Array<{ columnId: string; targetTableId: string; targetColumnId: string }>,
    allTables: Map<string, TableDef>,
    generatedData: GeneratedData,
    usedValues: Map<string, Set<unknown>>,
  ): unknown {
    // 1. Serial / auto-increment PK
    if (col.dataType === 'SERIAL') return rowIndex + 1;

    // 2. FK column — pick from parent table
    const fkMap = fkMappings.find((m) => m.columnId === col.id);
    if (fkMap) {
      const parentRows = generatedData.get(fkMap.targetTableId);
      if (parentRows && parentRows.length > 0) {
        const targetTable = allTables.get(fkMap.targetTableId);
        const targetCol = targetTable?.columns.find((c) => c.id === fkMap.targetColumnId);
        if (targetCol) {
          const parentRow = parentRows[this.faker.number.int({ min: 0, max: parentRows.length - 1 })];
          return parentRow[targetCol.name] ?? null;
        }
      }
      // Self-reference or parent not generated yet
      return col.isNullable ? null : this.fallbackByType(col, rowIndex);
    }

    // 3. Explicit faker provider
    if (col.fakerProvider) {
      return this.ensureUnique(col, () => callFakerProvider(this.faker, col.fakerProvider!), usedValues);
    }

    // 4. PK with UUID type
    if (col.isPrimaryKey && col.dataType === 'UUID') {
      return this.faker.string.uuid();
    }

    // 5. PK with integer type
    if (col.isPrimaryKey) {
      return rowIndex + 1;
    }

    // 6. Name pattern match
    const patternValue = valueFromNamePattern(this.faker, col.name);
    if (patternValue !== null) {
      return col.isUnique
        ? this.ensureUnique(col, () => valueFromNamePattern(this.faker, col.name) as unknown, usedValues)
        : patternValue;
    }

    // 7. Data-type fallback
    return this.ensureUnique(col, () => this.fallbackByType(col, rowIndex), usedValues);
  }

  private fallbackByType(col: ColumnDef, rowIndex: number): unknown {
    switch (col.dataType) {
      case 'INTEGER':
      case 'BIGINT': return this.faker.number.int({ min: 1, max: 100_000 });
      case 'DECIMAL': return parseFloat(this.faker.number.float({ min: 0, max: 10_000, fractionDigits: 2 }).toFixed(2));
      case 'BOOLEAN': return this.faker.datatype.boolean();
      case 'TIMESTAMP': return this.faker.date.past().toISOString();
      case 'DATE': return this.faker.date.past().toISOString().split('T')[0];
      case 'UUID': return this.faker.string.uuid();
      case 'JSON': return {};
      case 'VARCHAR':
      case 'TEXT':
      default: return this.faker.lorem.word();
    }
  }

  private ensureUnique(
    col: ColumnDef,
    generate: () => unknown,
    usedValues: Map<string, Set<unknown>>,
  ): unknown {
    const tracked = usedValues.get(col.id);
    if (!tracked) return generate(); // not a unique column — just generate

    for (let attempt = 0; attempt < 20; attempt++) {
      const value = generate();
      if (!tracked.has(value)) {
        tracked.add(value);
        return value;
      }
    }
    // After 20 retries, append a suffix to guarantee uniqueness
    const value = `${generate()}_${this.faker.string.alphanumeric(4)}`;
    tracked.add(value);
    return value;
  }
}

// Kahn's algorithm — tables with no incoming FK edges go first
export function topologicalSort(
  tables: TableDef[],
  relationships: RelationshipDef[],
): TableDef[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const t of tables) {
    inDegree.set(t.id, 0);
    adj.set(t.id, []);
  }

  for (const rel of relationships) {
    if (rel.sourceTableId === rel.targetTableId) continue; // skip self-refs
    adj.get(rel.targetTableId)?.push(rel.sourceTableId);
    inDegree.set(rel.sourceTableId, (inDegree.get(rel.sourceTableId) ?? 0) + 1);
  }

  const queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  const sorted: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(id);
    for (const dep of (adj.get(id) ?? [])) {
      const newDeg = (inDegree.get(dep) ?? 1) - 1;
      inDegree.set(dep, newDeg);
      if (newDeg === 0) queue.push(dep);
    }
  }

  const tableMap = new Map(tables.map((t) => [t.id, t]));
  // Append any tables involved in a cycle (shouldn't happen with valid FK schemas)
  const unsorted = tables.filter((t) => !sorted.includes(t.id));
  return [...sorted.map((id) => tableMap.get(id)!), ...unsorted];
}

// ── Export formatters ────────────────────────────────────────────────────────

export function formatSQL(tables: TableDef[], data: GeneratedData): string {
  const parts = [`-- Generated by Relatrix ${new Date().toISOString()}`, 'BEGIN;', ''];

  for (const table of tables) {
    const rows = data.get(table.id) ?? [];
    if (rows.length === 0) continue;
    const cols = table.columns.map((c) => `"${c.name}"`).join(', ');
    const valueLines = rows
      .map((row) => {
        const vals = table.columns.map((c) => sqlLiteral(row[c.name]));
        return `  (${vals.join(', ')})`;
      })
      .join(',\n');
    parts.push(`-- ${table.displayName}`);
    parts.push(`INSERT INTO "${table.name}" (${cols}) VALUES`);
    parts.push(valueLines + ';');
    parts.push('');
  }

  parts.push('COMMIT;');
  return parts.join('\n');
}

export function formatCSV(table: TableDef, rows: Array<Record<string, unknown>>): string {
  const header = table.columns.map((c) => c.name).join(',');
  const dataLines = rows.map((row) =>
    table.columns
      .map((c) => {
        const v = row[c.name];
        if (v === null || v === undefined) return '';
        const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      })
      .join(','),
  );
  return [header, ...dataLines].join('\n');
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}
