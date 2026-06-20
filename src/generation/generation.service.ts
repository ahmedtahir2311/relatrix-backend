import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import { generationJobs, schemas } from '../database/schema';
import type { GenerationEstimate } from '../database/schema/generation-jobs';
import { Paginated } from '../common/paginated';
import { topologicalSort } from './faker/faker.engine';
import type { StartGenerationDto } from './dto/start-generation.dto';
import type { GenerationJobData } from './generation.processor';

const SAFE_JOB_COLS = {
  id: generationJobs.id,
  userId: generationJobs.userId,
  schemaId: generationJobs.schemaId,
  schemaName: generationJobs.schemaName,
  status: generationJobs.status,
  config: generationJobs.config,
  estimate: generationJobs.estimate,
  rowsGenerated: generationJobs.rowsGenerated,
  rowsEstimated: generationJobs.rowsEstimated,
  errorInfo: generationJobs.errorInfo,
  createdAt: generationJobs.createdAt,
  startedAt: generationJobs.startedAt,
  completedAt: generationJobs.completedAt,
} as const;

@Injectable()
export class GenerationService {
  constructor(
    private readonly db: DrizzleService,
    @InjectQueue('generation') private readonly queue: Queue<GenerationJobData>,
  ) {}

  async estimate(userId: string, dto: StartGenerationDto): Promise<GenerationEstimate> {
    const schema = await this.loadSchema(dto.schemaId, userId);

    const tableDefs = schema.tables.map((t) => ({
      id: t.id,
      name: t.name,
      displayName: t.displayName,
      columns: t.columns,
    }));

    const relDefs = schema.relationships.map((r) => ({
      sourceTableId: r.sourceTableId,
      sourceColumnId: r.sourceColumnId,
      targetTableId: r.targetTableId,
      targetColumnId: r.targetColumnId,
    }));

    const sorted = topologicalSort(tableDefs, relDefs);

    const perTable: Record<string, number> = {};
    let totalRows = 0;
    for (const t of sorted) {
      const count = dto.tableRowCounts[t.id] ?? dto.batchSize;
      perTable[t.id] = count;
      totalRows += count;
    }

    return {
      totalRows,
      perTable,
      estimatedDurationMs: Math.ceil(totalRows * 0.8),
      estimatedSizeBytes: totalRows * 220,
      insertOrder: sorted.map((t) => t.id),
    };
  }

  async start(userId: string, dto: StartGenerationDto) {
    const schema = await this.loadSchema(dto.schemaId, userId);
    const estimate = await this.estimate(userId, dto);

    const config = {
      schemaId: dto.schemaId,
      tableRowCounts: estimate.perTable,
      seed: dto.seed ?? Math.floor(Math.random() * 2 ** 32),
      batchSize: dto.batchSize,
      locale: dto.locale,
      exportFormat: dto.exportFormat,
      connectionId: dto.connectionId,
    };

    const [job] = await this.db.db
      .insert(generationJobs)
      .values({
        userId,
        schemaId: dto.schemaId,
        schemaName: schema.name,
        config,
        estimate,
        rowsEstimated: estimate.totalRows,
      })
      .returning(SAFE_JOB_COLS);

    await this.queue.add(
      'generate',
      { jobId: job.id, userId, config, schemaName: schema.name } satisfies GenerationJobData,
      { jobId: job.id, attempts: 1, removeOnComplete: 50, removeOnFail: 50 },
    );

    return job;
  }

  async list(userId: string, offset: number, limit: number) {
    const where = eq(generationJobs.userId, userId);

    const [rows, [{ total }]] = await Promise.all([
      this.db.db
        .select(SAFE_JOB_COLS)
        .from(generationJobs)
        .where(where)
        .orderBy(desc(generationJobs.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.db
        .select({ total: sql<number>`COUNT(*)::int` })
        .from(generationJobs)
        .where(where),
    ]);

    return new Paginated(rows, { total, offset, limit });
  }

  async getOne(id: string, userId: string) {
    const [job] = await this.db.db
      .select()
      .from(generationJobs)
      .where(and(eq(generationJobs.id, id), eq(generationJobs.userId, userId)))
      .limit(1);

    if (!job) throw new NotFoundException('Generation job not found');
    return job;
  }

  async cancel(id: string, userId: string): Promise<{ id: string; status: string }> {
    const job = await this.getOne(id, userId);

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return { id, status: job.status };
    }

    // Remove from queue if still pending
    const bullJob = await this.queue.getJob(id);
    if (bullJob) {
      const state = await bullJob.getState();
      if (state === 'waiting' || state === 'delayed') {
        await bullJob.remove();
      }
    }

    await this.db.db
      .update(generationJobs)
      .set({ status: 'cancelled', completedAt: new Date() })
      .where(eq(generationJobs.id, id));

    return { id, status: 'cancelled' };
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
}
