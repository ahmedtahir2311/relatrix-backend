import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { DrizzleModule } from './database/drizzle.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { SchemasModule } from './schemas/schemas.module';
import { ConnectionsModule } from './connections/connections.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { env, isDev } from './config/env';

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
    DrizzleModule,
    RedisModule,
    HealthModule,
    AuthModule,
    SchemasModule,
    ConnectionsModule,
  ],
  providers: [
    // Apply JwtAuthGuard globally — use @Public() to exempt a route
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
