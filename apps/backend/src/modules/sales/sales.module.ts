import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SalesController } from './sales.controller';
import { SalesRepository } from './sales.repository';
import { SalesService } from './sales.service';

@Module({
  imports: [InventoryModule, AuditModule],
  controllers: [SalesController],
  providers: [SalesService, SalesRepository],
})
export class SalesModule {}
