export type DataType =
  | 'VARCHAR' | 'TEXT' | 'INTEGER' | 'BIGINT' | 'DECIMAL'
  | 'BOOLEAN' | 'TIMESTAMP' | 'DATE' | 'UUID' | 'SERIAL' | 'JSON';

export interface ColumnDef {
  id: string;
  name: string;
  dataType: DataType;
  isPrimaryKey: boolean;
  isNullable: boolean;
  isUnique: boolean;
  isForeignKey: boolean;
  defaultValue: string | null;
}

export interface TableDef {
  id: string;
  name: string;
  displayName: string;
  columns: ColumnDef[];
}

export interface RelationshipDef {
  id: string;
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
  onDelete: 'CASCADE' | 'SET_NULL' | 'RESTRICT' | 'NO_ACTION';
}

export interface BuildOptions {
  /** safe = CREATE IF NOT EXISTS; replace = DROP … CASCADE then CREATE */
  mode: 'safe' | 'replace';
  schemaName: string;
  dialect: 'postgresql' | 'mysql';
}
