import { buildPostgresSQL } from './postgres.builder';
import { buildMysqlSQL } from './mysql.builder';
import type { TableDef, RelationshipDef, BuildOptions } from './types';

export function buildSQL(
  tables: TableDef[],
  relationships: RelationshipDef[],
  options: BuildOptions,
): string {
  switch (options.dialect) {
    case 'postgresql':
      return buildPostgresSQL(tables, relationships, options);
    case 'mysql':
      return buildMysqlSQL(tables, relationships, options);
  }
}

export type { TableDef, RelationshipDef, BuildOptions } from './types';
