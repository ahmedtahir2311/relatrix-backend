import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import { dbConnections } from '../database/schema';
import { CryptoService } from '../common/crypto.service';
import { DbDriverFactory } from './drivers/db-driver.factory';
import { Paginated } from '../common/paginated';
import type { CreateConnectionDto } from './dto/create-connection.dto';
import type { UpdateConnectionDto } from './dto/update-connection.dto';

// Never expose passwordEncrypted to the API consumer
const SAFE_COLUMNS = {
  id: dbConnections.id,
  userId: dbConnections.userId,
  name: dbConnections.name,
  dialect: dbConnections.dialect,
  host: dbConnections.host,
  port: dbConnections.port,
  database: dbConnections.database,
  username: dbConnections.username,
  ssl: dbConnections.ssl,
  status: dbConnections.status,
  lastTestedAt: dbConnections.lastTestedAt,
  lastError: dbConnections.lastError,
  createdAt: dbConnections.createdAt,
  updatedAt: dbConnections.updatedAt,
} as const;

@Injectable()
export class ConnectionsService {
  constructor(
    private readonly db: DrizzleService,
    private readonly crypto: CryptoService,
    private readonly factory: DbDriverFactory,
  ) {}

  async list(userId: string) {
    const [rows, [{ total }]] = await Promise.all([
      this.db.db
        .select(SAFE_COLUMNS)
        .from(dbConnections)
        .where(eq(dbConnections.userId, userId))
        .orderBy(asc(dbConnections.createdAt)),
      this.db.db
        .select({ total: sql<number>`COUNT(*)::int` })
        .from(dbConnections)
        .where(eq(dbConnections.userId, userId)),
    ]);

    return new Paginated(rows, { total, offset: 0, limit: total });
  }

  async create(userId: string, dto: CreateConnectionDto) {
    const passwordEncrypted = this.crypto.encrypt(dto.password);
    const [row] = await this.db.db
      .insert(dbConnections)
      .values({
        userId,
        name: dto.name,
        dialect: dto.dialect,
        host: dto.host,
        port: dto.port,
        database: dto.database,
        username: dto.username,
        passwordEncrypted,
        ssl: dto.ssl,
      })
      .returning(SAFE_COLUMNS);
    return row;
  }

  async update(id: string, userId: string, dto: UpdateConnectionDto) {
    await this.assertOwnership(id, userId);

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.host !== undefined) patch.host = dto.host;
    if (dto.port !== undefined) patch.port = dto.port;
    if (dto.database !== undefined) patch.database = dto.database;
    if (dto.username !== undefined) patch.username = dto.username;
    if (dto.password !== undefined) patch.passwordEncrypted = this.crypto.encrypt(dto.password);
    if (dto.ssl !== undefined) patch.ssl = dto.ssl;

    // Any credential change resets status to untested
    const credentialChanged = dto.host || dto.port || dto.database || dto.username || dto.password || dto.ssl !== undefined;
    if (credentialChanged) {
      patch.status = 'untested';
      patch.lastTestedAt = null;
      patch.lastError = null;
    }

    const [row] = await this.db.db
      .update(dbConnections)
      .set(patch)
      .where(and(eq(dbConnections.id, id), eq(dbConnections.userId, userId)))
      .returning(SAFE_COLUMNS);
    return row;
  }

  async delete(id: string, userId: string): Promise<{ id: string }> {
    await this.assertOwnership(id, userId);
    await this.db.db
      .delete(dbConnections)
      .where(and(eq(dbConnections.id, id), eq(dbConnections.userId, userId)));
    return { id };
  }

  async test(id: string, userId: string) {
    const full = await this.assertOwnership(id, userId);
    const driver = this.factory.createFromConnection(full);

    let result: Awaited<ReturnType<typeof driver.testConnection>>;
    try {
      result = await driver.testConnection();
    } finally {
      await driver.disconnect().catch(() => undefined);
    }

    // Persist the outcome
    await this.db.db
      .update(dbConnections)
      .set({
        status: result.ok ? 'ok' : 'failed',
        lastTestedAt: new Date(),
        lastError: result.ok ? null : (result.error ?? null),
        updatedAt: new Date(),
      })
      .where(eq(dbConnections.id, id));

    return result;
  }

  private async assertOwnership(id: string, userId: string) {
    const [conn] = await this.db.db
      .select()
      .from(dbConnections)
      .where(eq(dbConnections.id, id))
      .limit(1);

    if (!conn) throw new NotFoundException('Connection not found');
    if (conn.userId !== userId) throw new ForbiddenException('Access denied');
    return conn;
  }
}
