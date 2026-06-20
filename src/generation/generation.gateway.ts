import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Server, Socket } from 'socket.io';
import { env } from '../config/env';

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

  afterInit(_server: Server) {
    // Gateway ready
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
