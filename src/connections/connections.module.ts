import { Module } from '@nestjs/common';
import { CryptoService } from '../common/crypto.service';
import { DbDriverFactory } from './drivers/db-driver.factory';
import { ConnectionsService } from './connections.service';
import { ConnectionsController } from './connections.controller';

@Module({
  providers: [CryptoService, DbDriverFactory, ConnectionsService],
  controllers: [ConnectionsController],
  exports: [CryptoService],
})
export class ConnectionsModule {}
