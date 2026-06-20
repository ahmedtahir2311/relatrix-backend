import { Pool } from 'pg';
import type { IDbDriver, DriverConfig, TestConnectionResult } from './db-driver.interface';

export class PostgresDriver implements IDbDriver {
  private pool: Pool;

  constructor(config: DriverConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5_000,
      max: 1,
    });
  }

  async testConnection(): Promise<TestConnectionResult> {
    const start = Date.now();
    try {
      const result = await this.pool.query<{ version: string }>('SELECT version()');
      const raw = result.rows[0]?.version ?? '';
      // Extract "PostgreSQL 16.2 ..." → "PostgreSQL 16.2"
      const serverVersion = raw.split(',')[0].trim();
      return { ok: true, latencyMs: Date.now() - start, serverVersion };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, error: (err as Error).message };
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }
}
