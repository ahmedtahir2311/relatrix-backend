import { createConnection, type Connection, type RowDataPacket } from 'mysql2/promise';
import type { IDbDriver, DriverConfig, TestConnectionResult } from './db-driver.interface';

export class MysqlDriver implements IDbDriver {
  private connection: Connection | null = null;

  constructor(private readonly config: DriverConfig) {}

  async testConnection(): Promise<TestConnectionResult> {
    const start = Date.now();
    try {
      const conn = await this.getConnection();
      const [rows] = await conn.query<RowDataPacket[]>('SELECT VERSION() AS version');
      return {
        ok: true,
        latencyMs: Date.now() - start,
        serverVersion: `MySQL ${rows[0]?.version ?? ''}`,
      };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, error: (err as Error).message };
    }
  }

  async executeSql(sql: string): Promise<void> {
    const conn = await this.getConnection();
    // Split on statement boundaries and run each inside one transaction
    const statements = sql
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--') && s !== 'BEGIN' && s !== 'COMMIT');

    await conn.beginTransaction();
    try {
      for (const stmt of statements) {
        await conn.query(stmt);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    await this.connection?.end();
    this.connection = null;
  }

  private async getConnection(): Promise<Connection> {
    if (!this.connection) {
      this.connection = await createConnection({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password,
        ssl: this.config.ssl ? {} : undefined,
        connectTimeout: 5_000,
      });
    }
    return this.connection;
  }
}
