import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { Namespace, Server, Socket } from 'socket.io';
import { env } from '../config/env';
import { RedisService } from '../redis/redis.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

export interface ProgressPayload {
  jobId: string;
  stage: 'generating' | 'formatting' | 'seeding';
  tableId?: string;
  tableName?: string;
  totalRowsGenerated: number;
  totalRowsEstimated: number;
  percentComplete: number;
}

@WebSocketGateway({
  namespace: 'generation',
  cors: {
    origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
  },
})
export class GenerationGateway implements OnGatewayInit {
  @WebSocketServer() server!: Namespace;

  constructor(
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
  ) {}

  afterInit(_server: Server) {
    this.server.use(async (socket: Socket, next) => {
      // Accept token from either socket.handshake.auth.token or query param
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (socket.handshake.query?.token as string | undefined);

      if (!token) return next(new Error('No authentication token provided'));

      try {
        const payload = this.jwt.verify<JwtPayload>(token);

        if (await this.redis.isTokenBlacklisted(payload.jti)) {
          return next(new Error('Token has been revoked'));
        }

        socket.data.userId = payload.sub;
        next();
      } catch {
        next(new Error('Invalid or expired token'));
      }
    });
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() jobId: string,
  ) {
    void socket.join(`job:${jobId}`);
    return { event: 'subscribed', data: { jobId } };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() jobId: string,
  ) {
    void socket.leave(`job:${jobId}`);
  }

  emitProgress(jobId: string, payload: Omit<ProgressPayload, 'jobId'>) {
    this.server.to(`job:${jobId}`).emit('progress', { jobId, ...payload });
  }

  emitCompleted(jobId: string, data: { rowsGenerated: number }) {
    this.server.to(`job:${jobId}`).emit('completed', { jobId, ...data });
  }

  emitFailed(jobId: string, error: string) {
    this.server.to(`job:${jobId}`).emit('failed', { jobId, error });
  }
}
