import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, Post, Query, Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { GenerationService } from './generation.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { z } from 'zod';
import { startGenerationSchema, StartGenerationDto } from './dto/start-generation.dto';

const listJobsQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

@ApiTags('generation')
@ApiBearerAuth('access-token')
@Controller('generation')
export class GenerationController {
  constructor(private readonly generation: GenerationService) {}

  @Post('estimate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Estimate row count and duration without running a job' })
  estimate(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(startGenerationSchema)) dto: StartGenerationDto,
  ) {
    return this.generation.estimate(user.id, dto);
  }

  @Post('start')
  @ApiOperation({ summary: 'Create and enqueue a generation job' })
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(startGenerationSchema)) dto: StartGenerationDto,
  ) {
    return this.generation.start(user.id, dto);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List generation jobs (paginated, newest first)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listJobsQuerySchema)) query: { offset: number; limit: number },
  ) {
    return this.generation.list(user.id, query.offset, query.limit);
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get a generation job including export content' })
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.generation.getOne(id, user.id);
  }

  @Delete('jobs/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending job or acknowledge a completed/failed one' })
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.generation.cancel(id, user.id);
  }

  @Get('jobs/:id/export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Download the generated export file' })
  async export(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const job = await this.generation.getOne(id, user.id);
    const info = job.exportInfo;
    if (!info) {
      res.status(404).json({ success: false, error: { code: 'NOT_READY', message: 'Export not ready' } });
      return;
    }

    if (info.format === 'SQL' && info.sql) {
      res.setHeader('Content-Type', 'application/sql');
      res.setHeader('Content-Disposition', `attachment; filename="${info.fileName}"`);
      res.send(info.sql);
    } else if (info.format === 'JSON' && info.json) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${info.fileName}"`);
      res.json(info.json);
    } else if (info.format === 'CSV' && info.csv) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${info.fileName}"`);
      res.json(info.csv);
    } else {
      res.json({ format: info.format, summary: info.directSeed ?? {} });
    }
  }
}
