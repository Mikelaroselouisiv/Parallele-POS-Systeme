import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { InventoryModule } from '../inventory/inventory.module';
import { RegisterSessionsController } from './register-sessions.controller';
import { RegisterSessionsService } from './register-sessions.service';

@Module({
  imports: [InventoryModule, AuditModule],
  controllers: [RegisterSessionsController],
  providers: [RegisterSessionsService],
  exports: [RegisterSessionsService],
})
export class RegisterSessionsModule {}
