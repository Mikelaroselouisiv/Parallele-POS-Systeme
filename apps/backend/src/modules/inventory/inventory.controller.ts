import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
// pdfkit ne fournit pas forcément de types utilisables côté TS.
// On garde un chargement dynamique pour éviter un blocage de compilation.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { InventoryService } from './inventory.service';
import {
  CreateInventorySessionDto,
  UpdateInventoryLineDto,
} from './dto/physical-inventory.dto';
import { StockAdjustmentDto, StockMovementDto } from './dto/stock-movement.dto';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('sessions')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER')
  createSession(
    @Body() dto: CreateInventorySessionDto,
    @GetUser() user?: { id?: number },
  ) {
    return this.inventoryService.createPhysicalInventorySession(
      dto.departmentId,
      dto.label,
      dto.note,
      user?.id,
      dto.kind ?? undefined,
    );
  }

  @Get('sessions')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER')
  listSessions(
    @Query('departmentId') departmentId?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.inventoryService.listInventorySessions(
      InventoryController.parseSessionFilters(departmentId, companyId),
    );
  }

  @Get('count-sheet')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER', 'ACCOUNTANT', 'CASHIER')
  getCountSheet(@Query('departmentId') departmentId?: string) {
    const deptId = InventoryController.parsePositiveInt(departmentId);
    if (!deptId) {
      throw new BadRequestException('departmentId est requis.');
    }
    return this.inventoryService.getCountSheetContext(deptId);
  }

  @Get('count-sheet/export/pdf')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER', 'ACCOUNTANT')
  async exportCountSheetPdf(
    @Res() res: Response,
    @Query('departmentId') departmentId?: string,
  ) {
    const deptId = InventoryController.parsePositiveInt(departmentId);
    if (!deptId) {
      throw new BadRequestException('departmentId est requis.');
    }
    const sheet = await this.inventoryService.getCountSheetContext(deptId);
    const pdfBuffer = await InventoryController.buildCountSheetPdf(sheet);
    const filenameDate = new Date().toISOString().slice(0, 10);
    const safeName = `${sheet.department.company.name}_${sheet.department.name}`
      .replace(/[^\w\- ]+/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 50);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="feuille_inventaire_${safeName}_${filenameDate}.pdf"`,
    );
    res.send(pdfBuffer);
  }

  @Get('sessions/:id')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER')
  getSession(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.getInventorySession(id);
  }

  @Patch('sessions/:sessionId/lines/:lineId')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER')
  updateLine(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Param('lineId', ParseIntPipe) lineId: number,
    @Body() dto: UpdateInventoryLineDto,
    @GetUser() user?: { id?: number },
  ) {
    return this.inventoryService.updateInventoryLine(sessionId, lineId, dto, user?.id);
  }

  @Post('sessions/:id/complete')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER')
  completeSession(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user?: { id?: number },
  ) {
    return this.inventoryService.completeInventorySession(id, user?.id);
  }

  @Post('sessions/:id/cancel')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER')
  cancelSession(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user?: { id?: number },
  ) {
    return this.inventoryService.cancelInventorySession(id, user?.id);
  }

  @Post('entries')
  @Roles('ADMIN')
  stockIn(@Body() dto: StockMovementDto, @GetUser() user?: { id?: number }) {
    return this.inventoryService.increaseStock(dto.productId, dto.quantity, dto.reason, user?.id);
  }

  @Post('adjustments')
  @Roles('ADMIN')
  adjust(@Body() dto: StockAdjustmentDto, @GetUser() user?: { id?: number }) {
    return this.inventoryService.adjustStock(dto.productId, dto.quantity, dto.reason, user?.id);
  }

  @Get('movements')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER')
  movements(
    @Query('skip') skipRaw?: string,
    @Query('take') takeRaw?: string,
    @Query('companyId') companyIdRaw?: string,
    @Query('order') orderRaw?: string,
  ) {
    const parseIntOr = (raw: string | undefined, fallback: number) => {
      if (raw === undefined || raw === '') return fallback;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : fallback;
    };
    const order = orderRaw === 'asc' ? 'asc' : 'desc';
    return this.inventoryService.getMovements({
      skip: parseIntOr(skipRaw, 0),
      take: parseIntOr(takeRaw, 100),
      companyId: companyIdRaw ? Number.parseInt(companyIdRaw, 10) : undefined,
      order,
    });
  }

  @Get('global-snapshot')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER', 'ACCOUNTANT')
  globalSnapshot(
    @Query('companyIds') companyIdsRaw?: string,
    @Query('departmentIds') departmentIdsRaw?: string,
  ) {
    const parseIds = (raw?: string) =>
      raw
        ?.split(',')
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
    return this.inventoryService.getGlobalStockSnapshot({
      companyIds: parseIds(companyIdsRaw),
      departmentIds: parseIds(departmentIdsRaw),
    });
  }

  @Get('global-snapshot/export/pdf')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER', 'ACCOUNTANT')
  async exportGlobalSnapshotPdf(
    @Res() res: Response,
    @Query('companyIds') companyIdsRaw?: string,
    @Query('departmentIds') departmentIdsRaw?: string,
  ) {
    const parseIds = (raw?: string) =>
      raw
        ?.split(',')
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
    const snapshot = await this.inventoryService.getGlobalStockSnapshot({
      companyIds: parseIds(companyIdsRaw),
      departmentIds: parseIds(departmentIdsRaw),
    });

    const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));

    const fmtNum = (v: number) =>
      Number.isFinite(v)
        ? v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
        : '—';

    doc.fontSize(18).text('Inventaire global');
    doc.moveDown(0.35);
    doc.fontSize(10).text(`Généré le ${new Date(snapshot.generatedAt).toLocaleString('fr-FR')}`);
    doc.fontSize(10).text(`Produits : ${snapshot.items.length}`);
    doc.moveDown(0.75);

    if (snapshot.items.length === 0) {
      doc.fontSize(11).text('Aucun produit.');
    } else {
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text('Entreprise | Département | Produit | SKU | Unité | Stock | Min | Statut');
      doc.font('Helvetica');
      doc.moveDown(0.25);
      for (const item of snapshot.items) {
        if (doc.y > 520) doc.addPage();
        const company = item.company?.name ?? '—';
        const dept = item.department?.name ?? '—';
        const status = item.lowStock ? 'Bas' : 'OK';
        doc.fontSize(8).text(
          `${company} | ${dept} | ${item.name} | ${item.sku ?? '—'} | ${item.unitLabel} | ${fmtNum(item.stock)} | ${fmtNum(item.stockMin)} | ${status}`,
        );
      }
    }

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });

    const filenameDate = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="inventaire_global_${filenameDate}.pdf"`,
    );
    res.send(pdfBuffer);
  }

  @Get('alerts')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER', 'CASHIER')
  alerts(
    @Query('threshold') threshold?: string,
    @Query('companyId') companyIdRaw?: string,
    @Query('skip') skipRaw?: string,
    @Query('take') takeRaw?: string,
  ) {
    const companyId = companyIdRaw ? Number.parseInt(companyIdRaw, 10) : undefined;
    const skip = skipRaw ? Number.parseInt(skipRaw, 10) : 0;
    const take = takeRaw ? Number.parseInt(takeRaw, 10) : 10;
    return this.inventoryService.getLowStockAlerts(Number(threshold ?? 5), companyId, { skip, take });
  }

  @Get('sessions/export/pdf')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER', 'ACCOUNTANT')
  async exportInventorySessionsPdf(
    @Res() res: Response,
    @Query('departmentId') departmentId?: string,
    @Query('companyId') companyId?: string,
    @Query('take') takeRaw?: string,
  ) {
    const parseIntOr = (raw: string | undefined, fallback: number) => {
      if (raw === undefined || raw === '') return fallback;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : fallback;
    };

    const filters = InventoryController.parseSessionFilters(departmentId, companyId);
    const take = parseIntOr(takeRaw, 80);

    const sessions = await this.inventoryService.listInventorySessionsForExport(filters, take);

    const statusLabel = (s: string) => {
      switch (s) {
        case 'DRAFT':
          return 'Brouillon';
        case 'COMPLETED':
          return 'Validé';
        case 'CANCELLED':
          return 'Annulé';
        default:
          return s;
      }
    };

    const fmtNum = (v: unknown) => {
      const n = Number(v ?? 0);
      if (!Number.isFinite(n)) return '—';
      return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
    };

    const fmtDate = (v: string | Date | null | undefined) => {
      if (!v) return '—';
      const d = typeof v === 'string' ? new Date(v) : v;
      if (!Number.isFinite(d.getTime())) return '—';
      return d.toLocaleString('fr-FR');
    };

    const filterLabel = InventoryController.describeSessionFilter(filters, sessions);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const filenameDate = new Date().toISOString().slice(0, 10);
    const safeFilter = filterLabel.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_').slice(0, 40);
    const fileBaseName = `historique_inventaires_${safeFilter}`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileBaseName}_${filenameDate}.pdf"`);

    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));

    doc.fontSize(18).text('Historique des inventaires', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Périmètre : ${filterLabel}`);
    doc.fontSize(11).text(`Sessions exportées : ${sessions.length}`);
    doc.fontSize(11).text(`Généré le : ${fmtDate(new Date().toISOString())}`);
    doc.moveDown();

    if (sessions.length === 0) {
      doc.fontSize(12).text('Aucune session trouvée pour ce filtre.');
    } else {
      for (const s of sessions) {
        doc.fontSize(13).text(`Session #${s.id} — ${s.label ?? 'Sans libellé'}`);
        const kindLabels: Record<string, string> = {
          OPENING: 'Ouverture de période',
          CLOSING: 'Clôture de période',
          AD_HOC: 'Contrôle ponctuel',
        };
        const kindText = kindLabels[(s as { kind?: string }).kind ?? 'AD_HOC'] ?? 'Contrôle ponctuel';
        doc.fontSize(10).text(
          `Type : ${kindText} | Département : ${s.department.company.name} — ${s.department.name} | Statut : ${statusLabel(
            s.status,
          )}`,
        );
        doc.fontSize(10).text(`Créée : ${fmtDate(s.createdAt)}${s.completedAt ? ` | Clôturée : ${fmtDate(s.completedAt)}` : ''}`);
        if (s.note) {
          doc.fontSize(10).text(`Note : ${s.note}`);
        }

        doc.moveDown(0.35);
        doc.fontSize(9).text('Produit | Unité | Stock enregistré | Compté | Écart');
        const lines = s.lines ?? [];
        for (const line of lines) {
          const product = line.product;
          const sku = product.sku ? ` [${product.sku}]` : '';
          const open = Number(line.systemQtyAtOpen);
          const counted = line.countedQty != null ? Number(line.countedQty) : null;
          const variance = counted != null ? counted - open : null;
          const unit =
            product.saleUnits?.[0]?.packagingUnit?.label ??
            product.saleUnits?.[0]?.packagingUnit?.code ??
            '—';
          doc.fontSize(9).text(
            `• ${product.name}${sku} | ${unit} | ${fmtNum(open)} | ${
              counted != null ? fmtNum(counted) : '—'
            } | ${variance != null ? fmtNum(variance) : '—'}`,
          );
        }

        doc.moveDown();
      }
    }

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });

    res.send(pdfBuffer);
  }

  private static parsePositiveInt(raw?: string): number | undefined {
    if (raw === undefined || raw === '') return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }

  private static parseSessionFilters(
    departmentId?: string,
    companyId?: string,
  ): { departmentId?: number; companyId?: number } {
    const deptId = InventoryController.parsePositiveInt(departmentId);
    const compId = InventoryController.parsePositiveInt(companyId);
    if (deptId) return { departmentId: deptId };
    if (compId) return { companyId: compId };
    return {};
  }

  private static describeSessionFilter(
    filters: { departmentId?: number; companyId?: number },
    sessions: Array<{ department: { name: string; company: { name: string } } }>,
  ): string {
    if (filters.departmentId && sessions[0]) {
      return `${sessions[0].department.company.name} — ${sessions[0].department.name}`;
    }
    if (filters.companyId && sessions[0]) {
      return `${sessions[0].department.company.name} (tous départements)`;
    }
    return 'Toutes les entreprises';
  }

  private static buildCountSheetPdf(sheet: {
    generatedAt: string;
    department: { name: string; company: { name: string } };
    products: Array<{
      name: string;
      sku: string | null;
      stock: number;
      unitLabel: string;
    }>;
  }): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));

    const fmtNum = (v: number) =>
      Number.isFinite(v)
        ? v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
        : '—';
    const fmtDate = (v: string) => new Date(v).toLocaleString('fr-FR');

    doc.fontSize(18).text('Feuille d’inventaire physique');
    doc.moveDown(0.35);
    doc.fontSize(11).text(`${sheet.department.company.name} — ${sheet.department.name}`);
    doc.fontSize(10).text(`Généré le ${fmtDate(sheet.generatedAt)} · Stock système au moment de l’export`);
    doc.moveDown(0.75);

    if (sheet.products.length === 0) {
      doc.fontSize(11).text('Aucun produit avec stock suivi dans ce département.');
    } else {
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('#  Produit                          SKU        Unité              Stock syst.   Compté    Écart');
      doc.font('Helvetica');
      doc.moveDown(0.25);
      sheet.products.forEach((p, i) => {
        if (doc.y > 520) doc.addPage();
        const name = p.name.length > 28 ? `${p.name.slice(0, 26)}…` : p.name.padEnd(28, ' ');
        const sku = (p.sku ?? '—').slice(0, 10).padEnd(10, ' ');
        const unit = p.unitLabel.length > 16 ? `${p.unitLabel.slice(0, 14)}…` : p.unitLabel.padEnd(16, ' ');
        doc.fontSize(9).text(
          `${String(i + 1).padStart(2, ' ')}  ${name}  ${sku}  ${unit}  ${fmtNum(p.stock).padStart(10, ' ')}   ________   ________`,
        );
      });
    }

    doc.moveDown();
    doc.fontSize(8).fillColor('#444444').text(
      'Notez la quantité comptée sur le terrain. Écart = compté − stock système. ' +
        'Pour enregistrer les ajustements dans le POS, utilisez une session de comptage dans l’application.',
    );

    return new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }
}
