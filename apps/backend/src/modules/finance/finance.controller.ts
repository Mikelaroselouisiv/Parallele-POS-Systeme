import { BadRequestException, Body, Controller, Get, Post, UseGuards, Query } from '@nestjs/common';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CloseCashDto, CreateFinanceEntryDto } from './dto/finance-entry.dto';
import { FinanceLedgerNature, FinanceService } from './finance.service';

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('journal')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  journal(
    @Query('companyId') companyIdRaw?: string,
    @Query('skip') skipRaw?: string,
    @Query('take') takeRaw?: string,
  ) {
    const parseIntOr = (raw: string | undefined) => {
      if (raw === undefined || raw === '') return undefined;
      const n = Number.parseInt(raw, 10);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };
    return this.financeService.journal({
      companyId: parseIntOr(companyIdRaw),
      skip: skipRaw ? Number.parseInt(skipRaw, 10) : undefined,
      take: takeRaw ? Number.parseInt(takeRaw, 10) : undefined,
    });
  }

  @Get('ledger')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  ledger(
    @Query('companyId') companyIdRaw?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('nature') natureRaw?: string,
    @Query('skip') skipRaw?: string,
    @Query('take') takeRaw?: string,
  ) {
    const parseIntOr = (raw: string | undefined) => {
      if (raw === undefined || raw === '') return undefined;
      const n = Number.parseInt(raw, 10);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };
    const companyId = parseIntOr(companyIdRaw);
    if (companyId == null) {
      throw new BadRequestException('companyId requis');
    }
    if (!dateFrom?.trim() || !dateTo?.trim()) {
      throw new BadRequestException('dateFrom et dateTo requis');
    }
    const allowed: FinanceLedgerNature[] = ['all', 'purchase', 'sale', 'expense'];
    const nature = (allowed.includes(natureRaw as FinanceLedgerNature)
      ? natureRaw
      : 'all') as FinanceLedgerNature;
    return this.financeService.ledger({
      companyId,
      dateFrom: dateFrom.trim(),
      dateTo: dateTo.trim(),
      nature,
      skip: skipRaw ? Number.parseInt(skipRaw, 10) : undefined,
      take: takeRaw ? Number.parseInt(takeRaw, 10) : undefined,
    });
  }

  @Post('entries')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  createEntry(@Body() dto: CreateFinanceEntryDto, @GetUser() user?: { id?: number }) {
    return this.financeService.createEntry(dto, user?.id);
  }

  @Post('cash-closure')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  closeCash(@Body() dto: CloseCashDto, @GetUser() user?: { id?: number }) {
    return this.financeService.closeCash(dto, user?.id);
  }
}
