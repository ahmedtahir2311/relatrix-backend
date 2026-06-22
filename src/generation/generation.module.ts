import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConnectionsModule } from '../connections/connections.module';
import { AuthModule } from '../auth/auth.module';
import { GenerationGateway } from './generation.gateway';
import { GenerationProcessor } from './generation.processor';
import { GenerationService } from './generation.service';
import { GenerationController } from './generation.controller';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'generation' }),
    ConnectionsModule,  // provides DbDriverFactory + CryptoService
    AuthModule,         // provides JwtService for WebSocket auth
  ],
  providers: [GenerationGateway, GenerationProcessor, GenerationService],
  controllers: [GenerationController],
})
export class GenerationModule {}
