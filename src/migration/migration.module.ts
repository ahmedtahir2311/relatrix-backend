import { Module } from '@nestjs/common';
import { ConnectionsModule } from '../connections/connections.module';
import { MigrationService } from './migration.service';
import { MigrationController } from './migration.controller';

@Module({
  imports: [ConnectionsModule],
  providers: [MigrationService],
  controllers: [MigrationController],
})
export class MigrationModule {}
