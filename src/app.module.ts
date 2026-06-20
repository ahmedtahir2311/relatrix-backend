import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { DrizzleModule } from './database/drizzle.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { SchemasModule } from './schemas/schemas.module';
import { ConnectionsModule } from './connections/connections.module';
import { GenerationModule } from './generation/generation.module';
import { MigrationModule } from './migration/migration.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { env, isDev } from './config/env';

function parseRedisConnection(url: string) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: parseInt(u.port || '6379', 10),
      password: u.password || undefined,
      db: parseInt(u.pathname.replace(/^\//, '') || '0', 10),
      lazyConnect: true,
      enableReadyCheck: false,
      maxRetriesPerRequest: null as unknown as number, // required by BullMQ
    };
  } catch {
    return {
      host: '127.0.0.1',
      port: 6379,
      lazyConnect: true,
      maxRetriesPerRequest: null as unknown as number,
    };
  }
}

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL,
        transport: isDev ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
        redact: ['req.headers.authorization', 'req.body.password', 'req.body.currentPassword'],
        serializers: {
          req: (req) => ({ method: req.method, url: req.url, id: req.id }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
      },
    }),
    ThrottlerModule.forRoot([
      // Global limit — 120 req/min per IP (generous baseline for all routes)
      { name: 'global', ttl: 60_000, limit: 120 },
      // Auth limit — overridden on sensitive endpoints to 5 req/min
      { name: 'auth', ttl: 60_000, limit: 120 },
    ]),
    BullModule.forRoot({ connection: parseRedisConnection(env.REDIS_URL) }),
    DrizzleModule,
    RedisModule,
    HealthModule,
    AuthModule,
    SchemasModule,
    ConnectionsModule,
    GenerationModule,
    MigrationModule,
  ],
  providers: [
    // Rate limiter runs first — fail fast before auth processing
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
