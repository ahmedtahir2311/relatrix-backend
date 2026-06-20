import { z } from 'zod';

const RELATIONSHIP_TYPES = ['ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_MANY'] as const;
const ON_DELETE_ACTIONS = ['CASCADE', 'SET_NULL', 'RESTRICT', 'NO_ACTION'] as const;

export const createRelationshipSchema = z.object({
  sourceTableId: z.string().uuid('Invalid source table ID'),
  sourceColumnId: z.string().uuid('Invalid source column ID'),
  targetTableId: z.string().uuid('Invalid target table ID'),
  targetColumnId: z.string().uuid('Invalid target column ID'),
  relationshipType: z.enum(RELATIONSHIP_TYPES).default('ONE_TO_MANY'),
  minCardinality: z.number().int().min(0).default(0),
  maxCardinality: z.number().int().min(1).default(1),
  onDelete: z.enum(ON_DELETE_ACTIONS).default('NO_ACTION'),
});

export const updateRelationshipSchema = z.object({
  sourceTableId: z.string().uuid().optional(),
  sourceColumnId: z.string().uuid().optional(),
  targetTableId: z.string().uuid().optional(),
  targetColumnId: z.string().uuid().optional(),
  relationshipType: z.enum(RELATIONSHIP_TYPES).optional(),
  minCardinality: z.number().int().min(0).optional(),
  maxCardinality: z.number().int().min(1).optional(),
  onDelete: z.enum(ON_DELETE_ACTIONS).optional(),
});

// Full schema shape for PUT /schemas/:id (auto-save)
export const replaceSchemaBodySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  tables: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100),
      displayName: z.string().min(1).max(100),
      color: z.string().default('#6366f1'),
      positionX: z.number().default(0),
      positionY: z.number().default(0),
      columns: z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string().min(1).max(100),
          dataType: z.enum(['VARCHAR', 'TEXT', 'INTEGER', 'BIGINT', 'DECIMAL', 'BOOLEAN', 'TIMESTAMP', 'DATE', 'UUID', 'SERIAL', 'JSON']).default('TEXT'),
          isPrimaryKey: z.boolean().default(false),
          isNullable: z.boolean().default(true),
          isUnique: z.boolean().default(false),
          isForeignKey: z.boolean().default(false),
          defaultValue: z.string().optional().nullable(),
          fakerProvider: z.string().optional().nullable(),
          position: z.number().int().default(0),
        }),
      ),
    }),
  ),
  relationships: z.array(
    z.object({
      id: z.string().uuid(),
      sourceTableId: z.string().uuid(),
      sourceColumnId: z.string().uuid(),
      targetTableId: z.string().uuid(),
      targetColumnId: z.string().uuid(),
      relationshipType: z.enum(RELATIONSHIP_TYPES).default('ONE_TO_MANY'),
      minCardinality: z.number().int().default(0),
      maxCardinality: z.number().int().default(1),
      onDelete: z.enum(ON_DELETE_ACTIONS).default('NO_ACTION'),
    }),
  ),
});

export type CreateRelationshipDto = z.infer<typeof createRelationshipSchema>;
export type UpdateRelationshipDto = z.infer<typeof updateRelationshipSchema>;
export type ReplaceSchemaBodyDto = z.infer<typeof replaceSchemaBodySchema>;
