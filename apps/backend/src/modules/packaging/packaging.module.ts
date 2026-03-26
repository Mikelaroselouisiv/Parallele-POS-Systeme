import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PackagingUnitsController } from './packaging-units.controller';
import { PackagingUnitsService } from './packaging-units.service';

@Module({
  imports: [PrismaModule],
  controllers: [PackagingUnitsController],
  providers: [PackagingUnitsService],
  exports: [PackagingUnitsService],
})
export class PackagingModule {}
