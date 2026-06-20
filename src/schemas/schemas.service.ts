import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, ilike, notInArray, sql } from 'drizzle-orm';
import { DrizzleService } from '../database/drizzle.service';
import {
  schemas,
  tables,
  columns,
  relationships,
} from '../database/schema';
import { Paginated } from '../common/paginated';
import type { CreateSchemaDto, UpdateSchemaDto, QuerySchemasDto } from './dto/schema.dto';
import type { CreateTableDto, UpdateTableDto } from './dto/table.dto';
import type { CreateColumnDto, UpdateColumnDto } from './dto/column.dto';
import type { CreateRelationshipDto, UpdateRelationshipDto, ReplaceSchemaBodyDto } from './dto/relationship.dto';

@Injectable()
export class SchemasService {
  constructor(private readonly db: DrizzleService) {}

  // ── Schema CRUD ────────────────────────────────────────────────────────────

  async list(userId: string, query: QuerySchemasDto) {
    const { offset, limit, search } = query;

    const conditions = [eq(schemas.userId, userId)];
    if (search) conditions.push(ilike(schemas.name, `%${search}%`));
    const where = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      this.db.db
        .select({
          id: schemas.id,
          userId: schemas.userId,
          name: schemas.name,
          description: schemas.description,
          version: schemas.version,
          createdAt: schemas.createdAt,
          updatedAt: schemas.updatedAt,
          tableCount: sql<number>`(
            SELECT COUNT(*)::int FROM tables WHERE tables.schema_id = ${schemas.id}
          )`,
        })
        .from(schemas)
        .where(where)
        .orderBy(asc(schemas.createdAt))
        .limit(limit)
        .offset(offset),

      this.db.db
        .select({ total: sql<number>`COUNT(*)::int` })
        .from(schemas)
        .where(where),
    ]);

    return new Paginated(rows, { total, offset, limit });
  }

  async getFullSchema(id: string, userId: string) {
    await this.assertOwnership(id, userId);
    return this.buildFullSchema(id);
  }

  async create(userId: string, dto: CreateSchemaDto) {
    const [schema] = await this.db.db
      .insert(schemas)
      .values({ userId, name: dto.name, description: dto.description ?? null })
      .returning();

    return this.buildFullSchema(schema.id);
  }

  async update(id: string, userId: string, dto: UpdateSchemaDto) {
    await this.assertOwnership(id, userId);

    await this.db.db
      .update(schemas)
      .set({
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        updatedAt: new Date(),
      })
      .where(eq(schemas.id, id));

    return this.buildFullSchema(id);
  }

  async replace(id: string, userId: string, dto: ReplaceSchemaBodyDto) {
    await this.assertOwnership(id, userId);

    await this.db.db.transaction(async (tx) => {
      // 1 — update schema metadata + bump version
      await tx
        .update(schemas)
        .set({
          name: dto.name,
          description: dto.description ?? null,
          version: sql`${schemas.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schemas.id, id));

      const incomingTableIds = dto.tables.map((t) => t.id);
      const allIncomingColumns = dto.tables.flatMap((t) =>
        t.columns.map((c) => ({ ...c, tableId: t.id })),
      );
      const incomingRelIds = dto.relationships.map((r) => r.id);

      // 2 — upsert tables
      if (dto.tables.length > 0) {
        await tx
          .insert(tables)
          .values(dto.tables.map((t) => ({ id: t.id, schemaId: id, name: t.name, displayName: t.displayName, color: t.color, positionX: t.positionX, positionY: t.positionY })))
          .onConflictDoUpdate({
            target: tables.id,
            set: {
              name: sql`excluded.name`,
              displayName: sql`excluded.display_name`,
              color: sql`excluded.color`,
              positionX: sql`excluded.position_x`,
              positionY: sql`excluded.position_y`,
              updatedAt: new Date(),
            },
          });
      }

      // 3 — delete removed tables (cascades columns & relationships)
      if (incomingTableIds.length > 0) {
        await tx.delete(tables).where(
          and(eq(tables.schemaId, id), notInArray(tables.id, incomingTableIds)),
        );
      } else {
        await tx.delete(tables).where(eq(tables.schemaId, id));
      }

      // 4 — upsert columns
      if (allIncomingColumns.length > 0) {
        await tx
          .insert(columns)
          .values(allIncomingColumns.map((c) => ({
            id: c.id,
            tableId: c.tableId,
            name: c.name,
            dataType: c.dataType,
            isPrimaryKey: c.isPrimaryKey,
            isNullable: c.isNullable,
            isUnique: c.isUnique,
            isForeignKey: c.isForeignKey,
            defaultValue: c.defaultValue ?? null,
            fakerProvider: c.fakerProvider ?? null,
            position: c.position,
          })))
          .onConflictDoUpdate({
            target: columns.id,
            set: {
              name: sql`excluded.name`,
              dataType: sql`excluded.data_type`,
              isPrimaryKey: sql`excluded.is_primary_key`,
              isNullable: sql`excluded.is_nullable`,
              isUnique: sql`excluded.is_unique`,
              isForeignKey: sql`excluded.is_foreign_key`,
              defaultValue: sql`excluded.default_value`,
              fakerProvider: sql`excluded.faker_provider`,
              position: sql`excluded.position`,
              updatedAt: new Date(),
            },
          });
      }

      // 5 — upsert relationships
      if (dto.relationships.length > 0) {
        await tx
          .insert(relationships)
          .values(dto.relationships.map((r) => ({ ...r, schemaId: id })))
          .onConflictDoUpdate({
            target: relationships.id,
            set: {
              sourceTableId: sql`excluded.source_table_id`,
              sourceColumnId: sql`excluded.source_column_id`,
              targetTableId: sql`excluded.target_table_id`,
              targetColumnId: sql`excluded.target_column_id`,
              relationshipType: sql`excluded.relationship_type`,
              minCardinality: sql`excluded.min_cardinality`,
              maxCardinality: sql`excluded.max_cardinality`,
              onDelete: sql`excluded.on_delete`,
              updatedAt: new Date(),
            },
          });
      }

      // 6 — delete removed relationships
      if (incomingRelIds.length > 0) {
        await tx.delete(relationships).where(
          and(eq(relationships.schemaId, id), notInArray(relationships.id, incomingRelIds)),
        );
      } else {
        await tx.delete(relationships).where(eq(relationships.schemaId, id));
      }
    });

    return this.buildFullSchema(id);
  }

  async delete(id: string, userId: string): Promise<{ id: string }> {
    await this.assertOwnership(id, userId);
    await this.db.db.delete(schemas).where(eq(schemas.id, id));
    return { id };
  }

  async validate(id: string, userId: string) {
    await this.assertOwnership(id, userId);
    const schema = await this.buildFullSchema(id);
    const issues: Array<{ type: 'error' | 'warning'; code: string; message: string; tableId?: string; columnId?: string; relationshipId?: string }> = [];

    const tableNames = new Set<string>();

    for (const table of schema.tables) {
      // Duplicate table names
      if (tableNames.has(table.name)) {
        issues.push({ type: 'error', code: 'DUPLICATE_TABLE_NAME', message: `Duplicate table name: "${table.name}"`, tableId: table.id });
      }
      tableNames.add(table.name);

      // Empty table
      if (table.columns.length === 0) {
        issues.push({ type: 'warning', code: 'EMPTY_TABLE', message: `Table "${table.displayName}" has no columns`, tableId: table.id });
        continue;
      }

      // Primary key check
      const pkCount = table.columns.filter((c) => c.isPrimaryKey).length;
      if (pkCount === 0) {
        issues.push({ type: 'error', code: 'NO_PRIMARY_KEY', message: `Table "${table.displayName}" has no primary key`, tableId: table.id });
      } else if (pkCount > 1) {
        issues.push({ type: 'warning', code: 'MULTIPLE_PRIMARY_KEYS', message: `Table "${table.displayName}" has ${pkCount} primary key columns`, tableId: table.id });
      }

      // Duplicate column names
      const colNames = new Set<string>();
      for (const col of table.columns) {
        if (colNames.has(col.name)) {
          issues.push({ type: 'error', code: 'DUPLICATE_COLUMN_NAME', message: `Duplicate column name "${col.name}" in table "${table.displayName}"`, tableId: table.id, columnId: col.id });
        }
        colNames.add(col.name);
      }
    }

    // Relationship validity
    const tableIndex = new Map(schema.tables.map((t) => [t.id, t]));
    for (const rel of schema.relationships) {
      const src = tableIndex.get(rel.sourceTableId);
      const tgt = tableIndex.get(rel.targetTableId);
      if (!src || !tgt) {
        issues.push({ type: 'error', code: 'INVALID_RELATIONSHIP', message: 'Relationship references a non-existent table', relationshipId: rel.id });
        continue;
      }
      const srcColExists = src.columns.some((c) => c.id === rel.sourceColumnId);
      const tgtColExists = tgt.columns.some((c) => c.id === rel.targetColumnId);
      if (!srcColExists || !tgtColExists) {
        issues.push({ type: 'error', code: 'INVALID_RELATIONSHIP_COLUMN', message: `Relationship between "${src.displayName}" → "${tgt.displayName}" references a missing column`, relationshipId: rel.id });
      }
    }

    return { valid: issues.filter((i) => i.type === 'error').length === 0, issues };
  }

  // ── Tables ─────────────────────────────────────────────────────────────────

  async addTable(schemaId: string, userId: string, dto: CreateTableDto) {
    await this.assertOwnership(schemaId, userId);
    await this.db.db.insert(tables).values({
      schemaId,
      name: dto.name,
      displayName: dto.displayName ?? dto.name,
      color: dto.color,
      positionX: dto.positionX,
      positionY: dto.positionY,
    });
    await this.bumpVersion(schemaId);
    return this.buildFullSchema(schemaId);
  }

  async updateTable(schemaId: string, tableId: string, userId: string, dto: UpdateTableDto) {
    await this.assertOwnership(schemaId, userId);
    await this.db.db
      .update(tables)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(tables.id, tableId), eq(tables.schemaId, schemaId)));
    await this.bumpVersion(schemaId);
    return this.buildFullSchema(schemaId);
  }

  async deleteTable(schemaId: string, tableId: string, userId: string) {
    await this.assertOwnership(schemaId, userId);
    await this.db.db
      .delete(tables)
      .where(and(eq(tables.id, tableId), eq(tables.schemaId, schemaId)));
    await this.bumpVersion(schemaId);
    return this.buildFullSchema(schemaId);
  }

  // ── Columns ────────────────────────────────────────────────────────────────

  async addColumn(schemaId: string, userId: string, dto: CreateColumnDto) {
    await this.assertOwnership(schemaId, userId);
    await this.db.db.insert(columns).values({
      tableId: dto.tableId,
      name: dto.name,
      dataType: dto.dataType,
      isPrimaryKey: dto.isPrimaryKey,
      isNullable: dto.isNullable,
      isUnique: dto.isUnique,
      isForeignKey: dto.isForeignKey,
      defaultValue: dto.defaultValue ?? null,
      fakerProvider: dto.fakerProvider ?? null,
      position: dto.position,
    });
    await this.bumpVersion(schemaId);
    return this.buildFullSchema(schemaId);
  }

  async updateColumn(schemaId: string, columnId: string, userId: string, dto: UpdateColumnDto) {
    await this.assertOwnership(schemaId, userId);
    await this.db.db
      .update(columns)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(columns.id, columnId));
    await this.bumpVersion(schemaId);
    return this.buildFullSchema(schemaId);
  }

  async deleteColumn(schemaId: string, columnId: string, userId: string) {
    await this.assertOwnership(schemaId, userId);
    await this.db.db.delete(columns).where(eq(columns.id, columnId));
    await this.bumpVersion(schemaId);
    return this.buildFullSchema(schemaId);
  }

  // ── Relationships ──────────────────────────────────────────────────────────

  async addRelationship(schemaId: string, userId: string, dto: CreateRelationshipDto) {
    await this.assertOwnership(schemaId, userId);
    await this.db.db.insert(relationships).values({ ...dto, schemaId });
    await this.bumpVersion(schemaId);
    return this.buildFullSchema(schemaId);
  }

  async updateRelationship(schemaId: string, relId: string, userId: string, dto: UpdateRelationshipDto) {
    await this.assertOwnership(schemaId, userId);
    await this.db.db
      .update(relationships)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(relationships.id, relId), eq(relationships.schemaId, schemaId)));
    await this.bumpVersion(schemaId);
    return this.buildFullSchema(schemaId);
  }

  async deleteRelationship(schemaId: string, relId: string, userId: string) {
    await this.assertOwnership(schemaId, userId);
    await this.db.db
      .delete(relationships)
      .where(and(eq(relationships.id, relId), eq(relationships.schemaId, schemaId)));
    await this.bumpVersion(schemaId);
    return this.buildFullSchema(schemaId);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async assertOwnership(schemaId: string, userId: string) {
    const [schema] = await this.db.db
      .select({ id: schemas.id, userId: schemas.userId })
      .from(schemas)
      .where(eq(schemas.id, schemaId))
      .limit(1);

    if (!schema) throw new NotFoundException('Schema not found');
    if (schema.userId !== userId) throw new ForbiddenException('Access denied');
    return schema;
  }

  private async bumpVersion(schemaId: string) {
    await this.db.db
      .update(schemas)
      .set({ version: sql`${schemas.version} + 1`, updatedAt: new Date() })
      .where(eq(schemas.id, schemaId));
  }

  private async buildFullSchema(schemaId: string) {
    const schema = await this.db.db.query.schemas.findFirst({
      where: (s, { eq: e }) => e(s.id, schemaId),
      with: {
        tables: {
          with: {
            columns: { orderBy: (col, { asc: a }) => [a(col.position)] },
          },
        },
        relationships: true,
      },
    });

    if (!schema) throw new NotFoundException('Schema not found');
    return schema;
  }
}
