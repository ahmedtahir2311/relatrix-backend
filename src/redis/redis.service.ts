import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from '../config/env';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  client!: Redis;

  onModuleInit() {
    this.client = new Redis(env.REDIS_URL, {
      // lazyConnect lets the app start even if Redis isn't up yet
      lazyConnect: true,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 500, 5_000),
    });

    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('ready', () => this.logger.log('Redis ready'));
    this.client.on('error', (err) => this.logger.warn(`Redis unavailable: ${err.message}`));
    this.client.on('reconnecting', () => this.logger.warn('Redis reconnecting…'));

    // Attempt connection in background — never crash the app if Redis is down
    this.client.connect().catch((err) => {
      this.logger.warn(`Redis initial connect failed (will retry): ${err.message}`);
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.log('Redis connection closed');
  }

  async ping(): Promise<number> {
    const start = Date.now();
    await this.client.ping();
    return Date.now() - start;
  }

  // ── Token blacklist helpers ──────────────────────────────────────────────────

  async blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
    await this.client.setex(`bl:${jti}`, ttlSeconds, '1');
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    const val = await this.client.get(`bl:${jti}`);
    return val === '1';
  }

  // ── Refresh token store ──────────────────────────────────────────────────────

  async storeRefreshToken(jti: string, userId: string, ttlSeconds: number): Promise<void> {
    await this.client.setex(`rt:${jti}`, ttlSeconds, userId);
  }

  /** Fetches the userId then deletes the key in one round-trip. Returns null if already consumed or not found. */
  async consumeRefreshToken(jti: string): Promise<string | null> {
    const key = `rt:${jti}`;
    const userId = await this.client.get(key);
    if (!userId) return null;
    await this.client.del(key);
    return userId;
  }

  async revokeRefreshToken(jti: string): Promise<void> {
    await this.client.del(`rt:${jti}`);
  }
}
