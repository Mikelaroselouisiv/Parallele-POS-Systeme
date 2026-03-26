import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CompaniesController } from './companies.controller';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';

@Module({
  imports: [PrismaModule],
  controllers: [CompanyController, CompaniesController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
