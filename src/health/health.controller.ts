import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DrizzleService } from '../database/drizzle.service';
import { RedisService } from '../redis/redis.service';
import { Public } from '../common/decorators/public.decorator';

interface CheckResult {
  status: 'ok' | 'error';
  latencyMs: number;
  error?: string;
}

interface HealthResponse {
  status: 'ok' | 'degraded';
  checks: {
    database: CheckResult;
    redis: CheckResult;
  };
  uptimeSeconds: number;
  timestamp: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Service health check' })
  async check(): Promise<HealthResponse> {
    const [database, redis] = await Promise.all([this.checkDb(), this.checkRedis()]);

    const status = database.status === 'ok' && redis.status === 'ok' ? 'ok' : 'degraded';

    return {
      status,
      checks: { database, redis },
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDb(): Promise<CheckResult> {
    try {
      const latencyMs = await this.drizzle.ping();
      return { status: 'ok', latencyMs };
    } catch (err) {
      return { status: 'error', latencyMs: -1, error: (err as Error).message };
    }
  }

  private async checkRedis(): Promise<CheckResult> {
    try {
      const latencyMs = await this.redis.ping();
      return { status: 'ok', latencyMs };
    } catch (err) {
      return { status: 'error', latencyMs: -1, error: (err as Error).message };
    }
  }
}
