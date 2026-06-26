import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, Patch, Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConnectionsService } from './connections.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { createConnectionSchema, CreateConnectionDto } from './dto/create-connection.dto';
import { updateConnectionSchema, UpdateConnectionDto } from './dto/update-connection.dto';
import { probeConnectionSchema, ProbeConnectionDto } from './dto/probe-connection.dto';

@ApiTags('connections')
@ApiBearerAuth('access-token')
@Controller('connections')
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  @Get()
  @ApiOperation({ summary: 'List all saved DB connections for the current user' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.connections.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Save a new DB connection (password is encrypted at rest)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createConnectionSchema)) dto: CreateConnectionDto,
  ) {
    return this.connections.create(user.id, dto);
  }

  @Post('probe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test raw credentials without creating a connection record' })
  probe(
    @CurrentUser() _user: AuthenticatedUser,
    @Body(new ZodValidationPipe(probeConnectionSchema)) dto: ProbeConnectionDto,
  ) {
    return this.connections.probe(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a DB connection; any credential change resets status to untested' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateConnectionSchema)) dto: UpdateConnectionDto,
  ) {
    return this.connections.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a DB connection' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.connections.delete(id, user.id);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test a DB connection (5s timeout); persists status in DB' })
  test(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.connections.test(id, user.id);
  }
}
