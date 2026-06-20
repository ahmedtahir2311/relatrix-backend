import {
  Body, Controller, Get, HttpCode, HttpStatus,
  Param, Post, Query, Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { MigrationService } from './migration.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  previewMigrationSchema,
  createMigrationJobSchema,
  PreviewMigrationDto,
  CreateMigrationJobDto,
} from './dto/migration.dto';

const listJobsQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

@ApiTags('migration')
@ApiBearerAuth('access-token')
@Controller('migration')
export class MigrationController {
  constructor(private readonly migration: MigrationService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate DDL SQL for a schema without creating a job (dialect must be specified)' })
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(previewMigrationSchema)) dto: PreviewMigrationDto,
  ) {
    return this.migration.preview(user.id, dto);
  }

  @Post('jobs')
  @ApiOperation({ summary: 'Create a migration job — SQL_FILE stores the DDL, DIRECT_APPLY also executes it' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createMigrationJobSchema)) dto: CreateMigrationJobDto,
  ) {
    return this.migration.create(user.id, dto);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List migration jobs (paginated, newest first)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listJobsQuerySchema)) query: { offset: number; limit: number },
  ) {
    return this.migration.list(user.id, query.offset, query.limit);
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get a migration job including the generated SQL' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.migration.getOne(id, user.id);
  }

  @Get('jobs/:id/download')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Download the generated SQL file' })
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const job = await this.migration.getOne(id, user.id);
    const info = job.exportInfo;
    if (!info?.sql) {
      res.status(404).json({ success: false, error: { code: 'NOT_READY', message: 'SQL not available' } });
      return;
    }
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="${info.fileName}"`);
    res.send(info.sql);
  }
}
