import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncApiKeyGuard } from './sync-api-key.guard';

@Module({
  controllers: [SyncController],
  providers: [SyncService, SyncApiKeyGuard],
  exports: [SyncService],
})
export class SyncModule {}
