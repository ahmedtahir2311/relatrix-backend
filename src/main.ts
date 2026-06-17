import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { env, isDev } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Buffer logs until the Pino logger is ready
    bufferLogs: true,
  });

  // ── Logger ─────────────────────────────────────────────────────────────────
  app.useLogger(app.get(Logger));

  // ── Security ────────────────────────────────────────────────────────────────
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.enableCors({
    origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // ── Global prefix ──────────────────────────────────────────────────────────
  app.setGlobalPrefix('api', {
    // Health check lives at /api/health, no exclusion needed
  });

  // ── Global filter & interceptor ────────────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // ── Swagger (dev + staging only) ───────────────────────────────────────────
  if (isDev || env.NODE_ENV === 'staging') {
    const config = new DocumentBuilder()
      .setTitle('Relatrix API')
      .setDescription('Production-level backend for the Relatrix schema designer')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    app.get(Logger).log(`Swagger → http://localhost:${env.PORT}/api/docs`);
  }

  // ── Listen ─────────────────────────────────────────────────────────────────
  await app.listen(env.PORT, '0.0.0.0');
  app.get(Logger).log(`🚀  Relatrix API running on http://localhost:${env.PORT}/api`);
}

bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
