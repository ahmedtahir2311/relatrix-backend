import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { HealthController } from '../src/health/health.controller';
import { DrizzleService } from '../src/database/drizzle.service';
import { RedisService } from '../src/redis/redis.service';

const mockDrizzle = { ping: jest.fn().mockResolvedValue(5) };
const mockRedis = { ping: jest.fn().mockResolvedValue(3) };

describe('/health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DrizzleService, useValue: mockDrizzle },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    mockDrizzle.ping.mockResolvedValue(5);
    mockRedis.ping.mockResolvedValue(3);
  });

  it('returns 200 with status ok when both services are healthy', async () => {
    const { body } = await request(app.getHttpServer()).get('/health').expect(200);

    expect(body.status).toBe('ok');
    expect(body.checks.database.status).toBe('ok');
    expect(body.checks.redis.status).toBe('ok');
    expect(typeof body.uptimeSeconds).toBe('number');
    expect(typeof body.timestamp).toBe('string');
  });

  it('returns status degraded when database ping fails', async () => {
    mockDrizzle.ping.mockRejectedValue(new Error('connection refused'));

    const { body } = await request(app.getHttpServer()).get('/health').expect(200);

    expect(body.status).toBe('degraded');
    expect(body.checks.database.status).toBe('error');
    expect(body.checks.database.error).toBe('connection refused');
    expect(body.checks.redis.status).toBe('ok');
  });

  it('returns status degraded when redis ping fails', async () => {
    mockRedis.ping.mockRejectedValue(new Error('redis timeout'));

    const { body } = await request(app.getHttpServer()).get('/health').expect(200);

    expect(body.status).toBe('degraded');
    expect(body.checks.redis.status).toBe('error');
    expect(body.checks.redis.error).toBe('redis timeout');
    expect(body.checks.database.status).toBe('ok');
  });

  it('returns status degraded when both services fail', async () => {
    mockDrizzle.ping.mockRejectedValue(new Error('db down'));
    mockRedis.ping.mockRejectedValue(new Error('redis down'));

    const { body } = await request(app.getHttpServer()).get('/health').expect(200);

    expect(body.status).toBe('degraded');
    expect(body.checks.database.status).toBe('error');
    expect(body.checks.redis.status).toBe('error');
  });

  it('includes latency in milliseconds for ok checks', async () => {
    const { body } = await request(app.getHttpServer()).get('/health').expect(200);
    expect(body.checks.database.latencyMs).toBe(5);
    expect(body.checks.redis.latencyMs).toBe(3);
  });

  it('includes latencyMs of -1 for failed checks', async () => {
    mockDrizzle.ping.mockRejectedValue(new Error('fail'));

    const { body } = await request(app.getHttpServer()).get('/health').expect(200);
    expect(body.checks.database.latencyMs).toBe(-1);
  });
});
