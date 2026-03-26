import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CompanyService } from './company.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdatePrinterDto } from './dto/update-printer.dto';

@Controller('company')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  profile() {
    return this.companyService.getProfile();
  }

  @Patch()
  @Roles('ADMIN')
  update(@Body() dto: UpdateCompanyDto) {
    return this.companyService.update(dto);
  }

  @Get('printer')
  @Roles('ADMIN', 'MANAGER', 'CASHIER', 'STOCK_MANAGER', 'ACCOUNTANT')
  printer(@Query('departmentId') departmentIdRaw?: string) {
    if (departmentIdRaw === undefined || departmentIdRaw === '') {
      return this.companyService.getPrinterSettings();
    }
    const id = parseInt(departmentIdRaw, 10);
    if (Number.isNaN(id)) {
      throw new BadRequestException('departmentId invalide');
    }
    return this.companyService.getPrinterSettings(id);
  }

  @Patch('printer')
  @Roles('ADMIN', 'MANAGER')
  updatePrinter(@Body() dto: UpdatePrinterDto) {
    return this.companyService.updatePrinterSettings(dto);
  }
}
