import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, Patch, Post, Put, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SchemasService } from './schemas.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { createSchemaSchema, updateSchemaSchema, querySchemasSchema } from './dto/schema.dto';
import { createTableSchema, updateTableSchema } from './dto/table.dto';
import { createColumnSchema, updateColumnSchema } from './dto/column.dto';
import { createRelationshipSchema, updateRelationshipSchema, replaceSchemaBodySchema } from './dto/relationship.dto';

@ApiTags('schemas')
@ApiBearerAuth('access-token')
@Controller('schemas')
export class SchemasController {
  constructor(private readonly schemas: SchemasService) {}

  // ── Schema CRUD ────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List schemas (paginated)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(querySchemasSchema)) query: { offset: number; limit: number; search?: string },
  ) {
    return this.schemas.list(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new schema' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createSchemaSchema)) dto: { name: string; description?: string | null },
  ) {
    return this.schemas.create(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a full schema with tables, columns, and relationships' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.schemas.getFullSchema(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partially update a schema (name, description)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSchemaSchema)) dto: { name?: string; description?: string | null },
  ) {
    return this.schemas.update(id, user.id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Full replace — used by auto-save to sync entire schema state' })
  replace(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(replaceSchemaBodySchema)) dto: Parameters<SchemasService['replace']>[2],
  ) {
    return this.schemas.replace(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a schema' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.schemas.delete(id, user.id);
  }

  @Post(':id/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate schema structure and return issues' })
  validate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.schemas.validate(id, user.id);
  }

  // ── Tables ─────────────────────────────────────────────────────────────────

  @Post(':id/tables')
  @ApiOperation({ summary: 'Add a table to a schema' })
  addTable(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') schemaId: string,
    @Body(new ZodValidationPipe(createTableSchema)) dto: Parameters<SchemasService['addTable']>[2],
  ) {
    return this.schemas.addTable(schemaId, user.id, dto);
  }

  @Patch(':id/tables/:tableId')
  @ApiOperation({ summary: 'Update a table' })
  updateTable(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') schemaId: string,
    @Param('tableId') tableId: string,
    @Body(new ZodValidationPipe(updateTableSchema)) dto: Parameters<SchemasService['updateTable']>[3],
  ) {
    return this.schemas.updateTable(schemaId, tableId, user.id, dto);
  }

  @Delete(':id/tables/:tableId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a table (cascades columns and relationships)' })
  deleteTable(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') schemaId: string,
    @Param('tableId') tableId: string,
  ) {
    return this.schemas.deleteTable(schemaId, tableId, user.id);
  }

  // ── Columns ────────────────────────────────────────────────────────────────

  @Post(':id/columns')
  @ApiOperation({ summary: 'Add a column to a table' })
  addColumn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') schemaId: string,
    @Body(new ZodValidationPipe(createColumnSchema)) dto: Parameters<SchemasService['addColumn']>[2],
  ) {
    return this.schemas.addColumn(schemaId, user.id, dto);
  }

  @Patch(':id/columns/:columnId')
  @ApiOperation({ summary: 'Update a column' })
  updateColumn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') schemaId: string,
    @Param('columnId') columnId: string,
    @Body(new ZodValidationPipe(updateColumnSchema)) dto: Parameters<SchemasService['updateColumn']>[3],
  ) {
    return this.schemas.updateColumn(schemaId, columnId, user.id, dto);
  }

  @Delete(':id/columns/:columnId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a column' })
  deleteColumn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') schemaId: string,
    @Param('columnId') columnId: string,
  ) {
    return this.schemas.deleteColumn(schemaId, columnId, user.id);
  }

  // ── Relationships ──────────────────────────────────────────────────────────

  @Post(':id/relationships')
  @ApiOperation({ summary: 'Add a relationship between tables' })
  addRelationship(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') schemaId: string,
    @Body(new ZodValidationPipe(createRelationshipSchema)) dto: Parameters<SchemasService['addRelationship']>[2],
  ) {
    return this.schemas.addRelationship(schemaId, user.id, dto);
  }

  @Patch(':id/relationships/:relId')
  @ApiOperation({ summary: 'Update a relationship' })
  updateRelationship(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') schemaId: string,
    @Param('relId') relId: string,
    @Body(new ZodValidationPipe(updateRelationshipSchema)) dto: Parameters<SchemasService['updateRelationship']>[3],
  ) {
    return this.schemas.updateRelationship(schemaId, relId, user.id, dto);
  }

  @Delete(':id/relationships/:relId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a relationship' })
  deleteRelationship(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') schemaId: string,
    @Param('relId') relId: string,
  ) {
    return this.schemas.deleteRelationship(schemaId, relId, user.id);
  }
}
