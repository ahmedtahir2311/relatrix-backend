export interface TestConnectionResult {
  ok: boolean;
  latencyMs: number;
  serverVersion?: string;
  error?: string;
}

export interface IDbDriver {
  testConnection(): Promise<TestConnectionResult>;
  // Execute a multi-statement SQL script (used for DIRECT_SEED)
  executeSql(sql: string): Promise<void>;
  disconnect(): Promise<void>;
}

export interface DriverConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}
