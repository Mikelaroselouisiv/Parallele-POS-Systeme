import { BadRequestException, Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('revenue')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  revenue() {
    return this.reportsService.revenue();
  }

  @Get('top-products')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  topProducts() {
    return this.reportsService.topProducts();
  }

  @Get('sales-by-cashier')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  salesByCashier() {
    return this.reportsService.salesByCashier();
  }

  @Get('margin')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  margin() {
    return this.reportsService.margin();
  }

  @Get('dashboard-summary')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  dashboardSummary(@Query('companyId') companyIdRaw?: string) {
    const n = companyIdRaw ? Number.parseInt(companyIdRaw, 10) : undefined;
    return this.reportsService.dashboardSummary(Number.isFinite(n) && (n as number) > 0 ? n : undefined);
  }

  @Get('dashboard-summary-range')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  dashboardSummaryRange(
    @Query('companyId') companyIdRaw: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('departmentId') departmentIdRaw?: string,
  ) {
    const companyId = companyIdRaw ? Number.parseInt(companyIdRaw, 10) : NaN;
    if (!Number.isFinite(companyId) || companyId <= 0) {
      throw new BadRequestException('companyId requis et valide');
    }
    if (!dateFrom?.trim() || !dateTo?.trim()) {
      throw new BadRequestException('dateFrom et dateTo sont requis (YYYY-MM-DD)');
    }
    const departmentIdN = departmentIdRaw ? Number.parseInt(departmentIdRaw, 10) : NaN;
    const departmentId =
      Number.isFinite(departmentIdN) && (departmentIdN as number) > 0 ? (departmentIdN as number) : undefined;
    return this.reportsService.dashboardSummaryRange(
      companyId,
      dateFrom.trim(),
      dateTo.trim(),
      departmentId,
    );
  }

  @Get('dashboard-sales-by-product/export/pdf')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async exportDashboardSalesByProductPdf(
    @Res() res: Response,
    @Query('companyId') companyIdRaw: string,
    @Query('period') periodRaw?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('departmentId') departmentIdRaw?: string,
  ) {
    const companyId = companyIdRaw ? Number.parseInt(companyIdRaw, 10) : NaN;
    if (!Number.isFinite(companyId) || companyId <= 0) {
      throw new BadRequestException('companyId requis et valide');
    }
    const period: 'day' | 'week' | 'month' =
      periodRaw === 'day' || periodRaw === 'week' || periodRaw === 'month' ? periodRaw : 'month';
    const departmentIdN = departmentIdRaw ? Number.parseInt(departmentIdRaw, 10) : NaN;
    const departmentId =
      Number.isFinite(departmentIdN) && (departmentIdN as number) > 0 ? (departmentIdN as number) : undefined;
    const opts =
      dateFrom?.trim() && dateTo?.trim()
        ? { dateFrom: dateFrom.trim(), dateTo: dateTo.trim(), ...(departmentId != null ? { departmentId } : {}) }
        : { period, ...(departmentId != null ? { departmentId } : {}) };
    const buffer = await this.reportsService.buildSalesByProductPdf(companyId, opts);
    const filenameDate = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ventes-par-produit_${companyId}_${filenameDate}.pdf"`,
    );
    res.send(buffer);
  }

  @Get('dashboard-synthesis/export/pdf')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  async exportFinancialSynthesisPdf(
    @Res() res: Response,
    @Query('companyId') companyIdRaw: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('departmentId') departmentIdRaw?: string,
  ) {
    const companyId = companyIdRaw ? Number.parseInt(companyIdRaw, 10) : NaN;
    if (!Number.isFinite(companyId) || companyId <= 0) {
      throw new BadRequestException('companyId requis et valide');
    }
    if (!dateFrom?.trim() || !dateTo?.trim()) {
      throw new BadRequestException('dateFrom et dateTo sont requis (YYYY-MM-DD)');
    }
    const departmentIdN = departmentIdRaw ? Number.parseInt(departmentIdRaw, 10) : NaN;
    const departmentId =
      Number.isFinite(departmentIdN) && (departmentIdN as number) > 0 ? (departmentIdN as number) : undefined;
    const buffer = await this.reportsService.buildFinancialSynthesisPdf(
      companyId,
      dateFrom.trim(),
      dateTo.trim(),
      departmentId,
    );
    const filenameDate = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="synthese-financiere_${companyId}_${filenameDate}.pdf"`,
    );
    res.send(buffer);
  }

  @Get('dashboard-sales-by-product')
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  dashboardSalesByProduct(
    @Query('companyId') companyIdRaw: string,
    @Query('period') periodRaw?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('departmentId') departmentIdRaw?: string,
  ) {
    const companyId = companyIdRaw ? Number.parseInt(companyIdRaw, 10) : NaN;
    if (!Number.isFinite(companyId) || companyId <= 0) {
      throw new BadRequestException('companyId requis et valide');
    }
    const period: 'day' | 'week' | 'month' =
      periodRaw === 'day' || periodRaw === 'week' || periodRaw === 'month' ? periodRaw : 'month';
    const departmentIdN = departmentIdRaw ? Number.parseInt(departmentIdRaw, 10) : NaN;
    const departmentId =
      Number.isFinite(departmentIdN) && (departmentIdN as number) > 0 ? (departmentIdN as number) : undefined;
    if (dateFrom?.trim() && dateTo?.trim()) {
      return this.reportsService.dashboardSalesByProduct(companyId, {
        dateFrom: dateFrom.trim(),
        dateTo: dateTo.trim(),
        ...(departmentId != null ? { departmentId } : {}),
      });
    }
    return this.reportsService.dashboardSalesByProduct(companyId, {
      period,
      ...(departmentId != null ? { departmentId } : {}),
    });
  }
}
