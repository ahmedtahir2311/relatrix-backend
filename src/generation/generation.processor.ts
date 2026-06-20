import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import { generationJobs, dbConnections } from '../database/schema';
import type { GenerationJobConfig, ExportInfo } from '../database/schema/generation-jobs';
import { DbDriverFactory } from '../connections/drivers/db-driver.factory';
import { GenerationGateway } from './generation.gateway';
import {
  FakerEngine,
  TableDef,
  RelationshipDef,
  GeneratedData,
  topologicalSort,
  formatSQL,
  formatCSV,
} from './faker/faker.engine';

export interface GenerationJobData {
  jobId: string;
  userId: string;
  config: GenerationJobConfig;
  schemaName: string;
}

@Processor('generation')
export class GenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(GenerationProcessor.name);

  constructor(
    private readonly db: DrizzleService,
    private readonly gateway: GenerationGateway,
    private readonly driverFactory: DbDriverFactory,
  ) {
    super();
  }

  async process(job: Job<GenerationJobData>): Promise<void> {
    const { jobId, config, schemaName } = job.data;

    await this.patchJob(jobId, { status: 'running', startedAt: new Date() });

    try {
      // Load schema with tables + columns + relationships
      const schema = await this.db.db.query.schemas.findFirst({
        where: (s, { eq: e }) => e(s.id, config.schemaId),
        with: {
          tables: { with: { columns: { orderBy: (c, { asc }) => [asc(c.position)] } } },
          relationships: true,
        },
      });

      if (!schema) throw new Error(`Schema ${config.schemaId} not found`);

      const tableDefs: TableDef[] = schema.tables.map((t) => ({
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
          fakerProvider: c.fakerProvider,
          position: c.position,
        })),
      }));

      const relDefs: RelationshipDef[] = schema.relationships.map((r) => ({
        sourceTableId: r.sourceTableId,
        sourceColumnId: r.sourceColumnId,
        targetTableId: r.targetTableId,
        targetColumnId: r.targetColumnId,
      }));

      const sortedTables = topologicalSort(tableDefs, relDefs);
      const allTablesMap = new Map(tableDefs.map((t) => [t.id, t]));

      const totalRows = sortedTables.reduce(
        (sum, t) => sum + (config.tableRowCounts[t.id] ?? config.batchSize),
        0,
      );

      const engine = new FakerEngine(config.seed);
      const generatedData: GeneratedData = new Map();
      let totalGenerated = 0;

      // ── Generation phase ────────────────────────────────────────────────────
      for (const table of sortedTables) {
        const count = config.tableRowCounts[table.id] ?? config.batchSize;
        const rows = engine.generateTable(table, count, allTablesMap, generatedData, relDefs);
        generatedData.set(table.id, rows);
        totalGenerated += rows.length;

        this.gateway.emitProgress(jobId, {
          stage: 'generating',
          tableId: table.id,
          tableName: table.displayName,
          totalRowsGenerated: totalGenerated,
          totalRowsEstimated: totalRows,
          percentComplete: Math.round((totalGenerated / totalRows) * 90),
        });

        await this.patchJob(jobId, { rowsGenerated: totalGenerated });
      }

      // ── Export phase ────────────────────────────────────────────────────────
      this.gateway.emitProgress(jobId, {
        stage: 'formatting',
        totalRowsGenerated: totalGenerated,
        totalRowsEstimated: totalRows,
        percentComplete: 95,
      });

      const exportInfo = await this.buildExport(
        config,
        sortedTables,
        generatedData,
        schemaName,
        jobId,
      );

      await this.patchJob(jobId, {
        status: 'completed',
        rowsGenerated: totalGenerated,
        exportInfo,
        completedAt: new Date(),
      });

      this.gateway.emitCompleted(jobId, { rowsGenerated: totalGenerated });
      this.logger.log(`Job ${jobId} completed — ${totalGenerated} rows`);
    } catch (err) {
      const message = (err as Error).message;
      this.logger.error(`Job ${jobId} failed: ${message}`);
      await this.patchJob(jobId, {
        status: 'failed',
        errorInfo: { code: 'GENERATION_ERROR', message },
        completedAt: new Date(),
      });
      this.gateway.emitFailed(jobId, message);
      throw err;
    }
  }

  private async buildExport(
    config: GenerationJobConfig,
    tables: TableDef[],
    data: GeneratedData,
    schemaName: string,
    jobId: string,
  ): Promise<ExportInfo> {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `${schemaName.replace(/\s+/g, '_')}_${ts}`;
    const downloadUrl = `/api/generation/jobs/${jobId}/export`;

    if (config.exportFormat === 'SQL') {
      const sql = formatSQL(tables, data);
      return {
        format: 'SQL',
        fileName: `${baseName}.sql`,
        fileSizeBytes: Buffer.byteLength(sql, 'utf8'),
        downloadUrl,
        sql,
      };
    }

    if (config.exportFormat === 'JSON') {
      const json: Record<string, unknown[]> = {};
      for (const t of tables) json[t.name] = data.get(t.id) ?? [];
      const jsonStr = JSON.stringify(json);
      return {
        format: 'JSON',
        fileName: `${baseName}.json`,
        fileSizeBytes: Buffer.byteLength(jsonStr, 'utf8'),
        downloadUrl,
        json,
      };
    }

    if (config.exportFormat === 'CSV') {
      const csv: Record<string, string> = {};
      let totalSize = 0;
      for (const t of tables) {
        const content = formatCSV(t, data.get(t.id) ?? []);
        csv[t.name] = content;
        totalSize += Buffer.byteLength(content, 'utf8');
      }
      return {
        format: 'CSV',
        fileName: `${baseName}.csv`,
        fileSizeBytes: totalSize,
        downloadUrl,
        csv,
      };
    }

    if (config.exportFormat === 'DIRECT_SEED') {
      if (!config.connectionId) throw new Error('connectionId required for DIRECT_SEED');

      const [conn] = await this.db.db
        .select()
        .from(dbConnections)
        .where(eq(dbConnections.id, config.connectionId))
        .limit(1);

      if (!conn) throw new Error('Connection not found');

      this.gateway.emitProgress(jobId, {
        stage: 'seeding',
        totalRowsGenerated: [...data.values()].reduce((s, r) => s + r.length, 0),
        totalRowsEstimated: [...data.values()].reduce((s, r) => s + r.length, 0),
        percentComplete: 96,
      });

      const driver = this.driverFactory.createFromConnection(conn);
      const sql = formatSQL(tables, data);
      try {
        await driver.executeSql(sql);
      } finally {
        await driver.disconnect().catch(() => undefined);
      }

      const rowsInserted = tables.reduce((s, t) => s + (data.get(t.id)?.length ?? 0), 0);
      return {
        format: 'DIRECT_SEED',
        fileName: '',
        fileSizeBytes: 0,
        downloadUrl: '',
        directSeed: {
          connectionId: config.connectionId,
          tablesSeeded: tables.map((t) => t.name),
          rowsInserted,
        },
      };
    }

    throw new Error(`Unknown export format: ${config.exportFormat}`);
  }

  private async patchJob(jobId: string, patch: Record<string, unknown>) {
    await this.db.db
      .update(generationJobs)
      .set(patch)
      .where(eq(generationJobs.id, jobId));
  }
}
