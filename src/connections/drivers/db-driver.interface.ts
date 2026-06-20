export interface TestConnectionResult {
  ok: boolean;
  latencyMs: number;
  serverVersion?: string;
  error?: string;
}

export interface IDbDriver {
  testConnection(): Promise<TestConnectionResult>;
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
