import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { SyncApiKeyGuard } from './sync-api-key.guard';
import { SyncPullQueryDto, SyncPushDto } from './dto/sync.dto';
import { SyncService } from './sync.service';

@Controller('sync')
@UseGuards(SyncApiKeyGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('entities')
  listEntities() {
    return { entities: this.syncService.listEntities() };
  }

  @Get('pull')
  pull(@Query() query: SyncPullQueryDto) {
    return this.syncService.pull(query.entity, query.since, query.take);
  }

  @Post('push')
  push(@Body() body: SyncPushDto) {
    return this.syncService.push(body);
  }
}
