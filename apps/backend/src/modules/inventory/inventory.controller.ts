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
    );
  }

  @Get('sessions')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER')
  listSessions(@Query('departmentId') departmentId?: string) {
    if (departmentId === undefined || departmentId === '') {
      return this.inventoryService.listInventorySessions(undefined);
    }
    const n = Number(departmentId);
    return this.inventoryService.listInventorySessions(
      Number.isFinite(n) && n > 0 ? n : undefined,
    );
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
  ) {
    return this.inventoryService.updateInventoryLine(sessionId, lineId, dto);
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
  cancelSession(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.cancelInventorySession(id);
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
    @Query('take') takeRaw?: string,
  ) {
    const parseIntOr = (raw: string | undefined, fallback: number) => {
      if (raw === undefined || raw === '') return fallback;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : fallback;
    };

    const deptIdN = departmentId === undefined || departmentId === '' ? undefined : Number(departmentId);
    const deptId = deptIdN && Number.isFinite(deptIdN) && deptIdN > 0 ? deptIdN : undefined;
    const take = parseIntOr(takeRaw, 80);

    const sessions = await this.inventoryService.listInventorySessionsForExport(deptId, take);

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
      return Number.isFinite(n) ? n.toFixed(3) : '—';
    };

    const fmtDate = (v: string | Date | null | undefined) => {
      if (!v) return '—';
      const d = typeof v === 'string' ? new Date(v) : v;
      if (!Number.isFinite(d.getTime())) return '—';
      return d.toLocaleString();
    };

    const filterLabel = sessions[0]
      ? `${sessions[0].department.company.name} — ${sessions[0].department.name}`
      : 'Tous les départements';

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const filenameDate = new Date().toISOString().slice(0, 10);
    const safeFilter = filterLabel.replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_').slice(0, 40);
    const fileBaseName = deptId ? `inventaires_${safeFilter}` : 'inventaires_tous_departements';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileBaseName}_${filenameDate}.pdf"`);

    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));

    // Titre & méta
    doc.fontSize(18).text('Inventaires physiques', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Filtre: ${filterLabel}`);
    doc.fontSize(11).text(`Nombre de sessions: ${sessions.length}`);
    doc.fontSize(11).text(`Généré le: ${fmtDate(new Date().toISOString())}`);
    doc.moveDown();

    if (sessions.length === 0) {
      doc.fontSize(12).text('Aucune session trouvée pour ce filtre.');
    } else {
      for (const s of sessions) {
        doc.fontSize(13).text(`Session #${s.id} — ${s.label ?? 'Sans libellé'}`);
        doc.fontSize(10).text(
          `Département: ${s.department.company.name} — ${s.department.name} | Statut: ${statusLabel(
            s.status,
          )}`,
        );
        doc.fontSize(10).text(`Créée: ${fmtDate(s.createdAt)}${s.completedAt ? ` | Clôturée: ${fmtDate(s.completedAt)}` : ''}`);
        if (s.note) {
          doc.fontSize(10).text(`Note: ${s.note}`);
        }

        doc.moveDown(0.35);

        doc.fontSize(9).text('Lignes:');
        const lines = s.lines ?? [];
        for (const line of lines) {
          const product = line.product;
          const sku = product.sku ? ` (${product.sku})` : '';
          doc
            .fontSize(9)
            .text(
              `• ${product.name}${sku} | Ouvert: ${fmtNum(line.systemQtyAtOpen)} | Compté: ${
                line.countedQty != null ? fmtNum(line.countedQty) : '—'
              } | Stock actuel: ${fmtNum(product.stock)}`,
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
}
