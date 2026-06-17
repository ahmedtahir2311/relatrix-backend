import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { env } from '../config/env';

export type DrizzleDb = NodePgDatabase<typeof schema>;

@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DrizzleService.name);
  private pool!: Pool;

  db!: DrizzleDb;

  async onModuleInit() {
    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    this.pool.on('error', (err) => {
      this.logger.error('Unexpected PostgreSQL pool error', err.message);
    });

    this.db = drizzle(this.pool, { schema, logger: false });

    // Verify connectivity on startup
    await this.pool.query('SELECT 1');
    this.logger.log('PostgreSQL connected');
  }

  async onModuleDestroy() {
    await this.pool.end();
    this.logger.log('PostgreSQL pool closed');
  }

  /** Raw pool access for health checks and one-off queries */
  async ping(): Promise<number> {
    const start = Date.now();
    await this.pool.query('SELECT 1');
    return Date.now() - start;
  }
}
