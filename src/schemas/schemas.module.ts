import { Module } from '@nestjs/common';
import { SchemasService } from './schemas.service';
import { SchemasController } from './schemas.controller';

@Module({
  providers: [SchemasService],
  controllers: [SchemasController],
  exports: [SchemasService],
})
export class SchemasModule {}
