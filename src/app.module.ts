import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { DrizzleModule } from './database/drizzle.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
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
  ],
})
export class AppModule {}
