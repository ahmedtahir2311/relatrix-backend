import { createConnection, type Connection, type RowDataPacket } from 'mysql2/promise';
import type { IDbDriver, DriverConfig, TestConnectionResult } from './db-driver.interface';

export class MysqlDriver implements IDbDriver {
  private connection: Connection | null = null;

  constructor(private readonly config: DriverConfig) {}

  async testConnection(): Promise<TestConnectionResult> {
    const start = Date.now();
    try {
      this.connection = await createConnection({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password,
        ssl: this.config.ssl ? {} : undefined,
        connectTimeout: 5_000,
      });
      const [rows] = await this.connection.query<RowDataPacket[]>(
        'SELECT VERSION() AS version',
      );
      return {
        ok: true,
        latencyMs: Date.now() - start,
        serverVersion: `MySQL ${rows[0]?.version ?? ''}`,
      };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, error: (err as Error).message };
    }
  }

  async disconnect(): Promise<void> {
    await this.connection?.end();
    this.connection = null;
  }
}
