import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import { migrationJobs, dbConnections, schemas } from '../database/schema';
import type { MigrationExportInfo } from '../database/schema/migration-jobs';
import { DbDriverFactory } from '../connections/drivers/db-driver.factory';
import { Paginated } from '../common/paginated';
import { buildSQL } from './sql-builder';
import type { TableDef, RelationshipDef } from './sql-builder';
import type { PreviewMigrationDto, CreateMigrationJobDto } from './dto/migration.dto';

@Injectable()
export class MigrationService {
  constructor(
    private readonly db: DrizzleService,
    private readonly driverFactory: DbDriverFactory,
  ) {}

  // ── Preview (no job record) ────────────────────────────────────────────────

  async preview(userId: string, dto: PreviewMigrationDto) {
    const schema = await this.loadSchema(dto.schemaId, userId);
    const { tables, relationships } = this.extractDefs(schema);

    const sql = buildSQL(tables, relationships, {
      mode: dto.mode,
      schemaName: schema.name,
      dialect: dto.dialect,
    });

    return {
      dialect: dto.dialect,
      mode: dto.mode,
      sql,
      tables: schema.tables.map((t) => ({ id: t.id, name: t.name, displayName: t.displayName })),
    };
  }

  // ── Create + run migration job ─────────────────────────────────────────────

  async create(userId: string, dto: CreateMigrationJobDto) {
    const schema = await this.loadSchema(dto.schemaId, userId);

    // For DIRECT_APPLY, infer dialect from the connection
    let dialect = dto.dialect as 'postgresql' | 'mysql';
    if (dto.format === 'DIRECT_APPLY' && dto.connectionId) {
      const [conn] = await this.db.db
        .select({ dialect: dbConnections.dialect })
        .from(dbConnections)
        .where(and(eq(dbConnections.id, dto.connectionId), eq(dbConnections.userId, userId)))
        .limit(1);
      if (!conn) throw new NotFoundException('Connection not found');
      dialect = conn.dialect;
    }

    const { tables, relationships } = this.extractDefs(schema);
    const generatedSql = buildSQL(tables, relationships, {
      mode: dto.mode,
      schemaName: schema.name,
      dialect,
    });

    const config = {
      schemaId: dto.schemaId,
      format: dto.format,
      mode: dto.mode,
      dialect,
      connectionId: dto.connectionId,
    };

    // Create job record
    const [job] = await this.db.db
      .insert(migrationJobs)
      .values({
        userId,
        schemaId: dto.schemaId,
        schemaName: schema.name,
        status: 'running',
        config,
      })
      .returning();

    try {
      if (dto.format === 'DIRECT_APPLY' && dto.connectionId) {
        await this.applyToConnection(dto.connectionId, generatedSql);
      }

      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${schema.name.replace(/\s+/g, '_')}_${ts}.sql`;
      const exportInfo: MigrationExportInfo = {
        downloadUrl: `/api/migration/jobs/${job.id}/download`,
        fileName,
        fileSizeBytes: Buffer.byteLength(generatedSql, 'utf8'),
        sql: generatedSql,
        dialect,
        tablesApplied: schema.tables.map((t) => t.name),
      };

      const [updated] = await this.db.db
        .update(migrationJobs)
        .set({
          status: 'completed',
          tablesApplied: schema.tables.length,
          exportInfo,
          completedAt: new Date(),
        })
        .where(eq(migrationJobs.id, job.id))
        .returning();

      return updated;
    } catch (err) {
      await this.db.db
        .update(migrationJobs)
        .set({
          status: 'failed',
          errorInfo: { message: (err as Error).message },
          completedAt: new Date(),
        })
        .where(eq(migrationJobs.id, job.id));
      throw err;
    }
  }

  // ── Job management ─────────────────────────────────────────────────────────

  async list(userId: string, offset: number, limit: number) {
    const where = eq(migrationJobs.userId, userId);

    const [rows, [{ total }]] = await Promise.all([
      this.db.db
        .select()
        .from(migrationJobs)
        .where(where)
        .orderBy(desc(migrationJobs.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.db
        .select({ total: sql<number>`COUNT(*)::int` })
        .from(migrationJobs)
        .where(where),
    ]);

    return new Paginated(rows, { total, offset, limit });
  }

  async getOne(id: string, userId: string) {
    const [job] = await this.db.db
      .select()
      .from(migrationJobs)
      .where(and(eq(migrationJobs.id, id), eq(migrationJobs.userId, userId)))
      .limit(1);

    if (!job) throw new NotFoundException('Migration job not found');
    return job;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async applyToConnection(connectionId: string, generatedSql: string): Promise<void> {
    const [conn] = await this.db.db
      .select()
      .from(dbConnections)
      .where(eq(dbConnections.id, connectionId))
      .limit(1);

    if (!conn) throw new NotFoundException('Connection not found');

    const driver = this.driverFactory.createFromConnection(conn);
    try {
      await driver.executeSql(generatedSql);
    } finally {
      await driver.disconnect().catch(() => undefined);
    }
  }

  private async loadSchema(schemaId: string, userId: string) {
    const schema = await this.db.db.query.schemas.findFirst({
      where: (s, { eq: e }) => e(s.id, schemaId),
      with: {
        tables: { with: { columns: { orderBy: (c, { asc: a }) => [a(c.position)] } } },
        relationships: true,
      },
    });

    if (!schema) throw new NotFoundException('Schema not found');
    if (schema.userId !== userId) throw new ForbiddenException('Access denied');
    return schema;
  }

  private extractDefs(schema: Awaited<ReturnType<typeof this.loadSchema>>) {
    const tables: TableDef[] = schema.tables.map((t) => ({
      id: t.id,
      name: t.name,
      displayName: t.displayName,
      columns: t.columns.map((c) => ({
        id: c.id,
        name: c.name,
        dataType: c.dataType,
        isPrimaryKey: c.isPrimaryKey,
        isNullable: c.isNullable,
        isUnique: c.isUnique,
        isForeignKey: c.isForeignKey,
        defaultValue: c.defaultValue,
      })),
    }));

    const relationships: RelationshipDef[] = schema.relationships.map((r) => ({
      id: r.id,
      sourceTableId: r.sourceTableId,
      sourceColumnId: r.sourceColumnId,
      targetTableId: r.targetTableId,
      targetColumnId: r.targetColumnId,
      onDelete: r.onDelete,
    }));

    return { tables, relationships };
  }
}
