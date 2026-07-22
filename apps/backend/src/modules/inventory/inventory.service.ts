import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventorySessionKind, InventorySessionStatus, MovementType, Prisma } from '@prisma/client';
import { USER_ATTRIBUTION_SELECT } from '../../common/user-attribution';
import {
  nowBusinessYmd,
  ymdToBusinessDayEnd,
  ymdToBusinessDayStart,
} from '../../common/utils/business-timezone';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { UpdateInventoryLineDto } from './dto/physical-inventory.dto';

/** Variation de stock d’un mouvement (IN/ADJUSTMENT +, OUT −). */
export function signedMovementDelta(type: MovementType, quantity: number): number {
  const q = Math.abs(Number(quantity));
  if (!Number.isFinite(q)) return 0;
  if (type === MovementType.OUT) return -q;
  return q;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async ensureStockAvailability(productId: number, quantity: number) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
    if (Number(product.stock) < quantity) {
      throw new BadRequestException(`Stock insuffisant pour ${product.name}`);
    }
    return product;
  }

  async ensureStockAvailabilityTx(
    tx: Prisma.TransactionClient,
    productId: number,
    quantity: number,
  ) {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
    if (Number(product.stock) < quantity) {
      throw new BadRequestException(`Stock insuffisant pour ${product.name}`);
    }
    return product;
  }

  async decrementStockTx(
    tx: Prisma.TransactionClient,
    productId: number,
    quantity: number,
    createdById?: number,
    reason = 'Sale',
  ) {
    await tx.product.update({
      where: { id: productId },
      data: { stock: { decrement: quantity } },
    });
    await tx.stockMovement.create({
      data: {
        productId,
        quantity,
        type: MovementType.OUT,
        reason,
        createdById,
      },
    });
  }

  async increaseStock(productId: number, quantity: number, reason?: string, createdById?: number) {
    await this.ensureProductExists(productId);
    await this.prisma.product.update({
      where: { id: productId },
      data: { stock: { increment: quantity } },
    });
    const movement = await this.prisma.stockMovement.create({
      data: {
        productId,
        quantity,
        type: MovementType.IN,
        reason: reason ?? 'Stock entry',
        createdById,
      },
      include: { product: true },
    });
    await this.auditService.log({
      userId: createdById,
      action: 'STOCK_IN',
      entity: 'StockMovement',
      entityId: String(movement.id),
      metadata: { productId, quantity, reason: movement.reason },
    });
    return movement;
  }

  async adjustStock(productId: number, quantity: number, reason?: string, createdById?: number) {
    await this.ensureProductExists(productId);
    if (quantity === 0) {
      throw new BadRequestException('La quantité doit être non nulle.');
    }
    if (quantity < 0) {
      const abs = Math.abs(quantity);
      await this.ensureStockAvailability(productId, abs);
    }
    await this.prisma.product.update({
      where: { id: productId },
      data: { stock: { increment: quantity } },
    });
    const abs = Math.abs(quantity);
    const movement = await this.prisma.stockMovement.create({
      data: {
        productId,
        quantity: abs,
        type: quantity < 0 ? MovementType.OUT : MovementType.ADJUSTMENT,
        reason: reason ?? (quantity < 0 ? 'Sortie manuelle' : 'Ajustement manuel'),
        createdById,
      },
      include: { product: true },
    });
    await this.auditService.log({
      userId: createdById,
      action: quantity < 0 ? 'STOCK_OUT' : 'STOCK_ADJUST',
      entity: 'StockMovement',
      entityId: String(movement.id),
      metadata: { productId, quantity, reason: movement.reason },
    });
    return movement;
  }

  private readonly movementsInclude = {
    product: {
      include: {
        saleUnits: {
          where: { isDefault: true },
          take: 1,
          include: { packagingUnit: true },
        },
      },
    },
    createdBy: { select: USER_ATTRIBUTION_SELECT },
    inventorySession: { select: { id: true, label: true, departmentId: true } },
    goodsReceipt: { select: { id: true, departmentId: true, status: true } },
  } satisfies Prisma.StockMovementInclude;

  /**
   * Journal des mouvements (ventes = OUT, réceptions, ajustements…), paginé pour éviter de tout charger.
   */
  async getMovements(opts?: {
    skip?: number;
    take?: number;
    companyId?: number;
    dateFrom?: string;
    dateTo?: string;
    /** Tri par date : plus récent d'abord (défaut) ou plus ancien d'abord. */
    order?: 'asc' | 'desc';
  }) {
    const skip = Math.max(0, Math.floor(opts?.skip ?? 0));
    const rawTake = opts?.take ?? 100;
    const take = Math.min(500, Math.max(1, Math.floor(rawTake)));
    const orderDir = opts?.order === 'asc' ? 'asc' : 'desc';

    const where: Prisma.StockMovementWhereInput = {};
    if (opts?.companyId) {
      where.product = { companyId: opts.companyId };
    }
    const createdAt: Prisma.DateTimeFilter = {};
    if (opts?.dateFrom?.trim()) {
      try {
        createdAt.gte = ymdToBusinessDayStart(opts.dateFrom.trim());
      } catch {
        /* ignore */
      }
    }
    if (opts?.dateTo?.trim()) {
      try {
        createdAt.lte = ymdToBusinessDayEnd(opts.dateTo.trim());
      } catch {
        /* ignore */
      }
    }
    if (createdAt.gte || createdAt.lte) {
      where.createdAt = createdAt;
    }

    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        include: this.movementsInclude,
        orderBy: { createdAt: orderDir },
        skip,
        take,
        where: Object.keys(where).length ? where : undefined,
      }),
      this.prisma.stockMovement.count({
        where: Object.keys(where).length ? where : undefined,
      }),
    ]);
    return { items, total };
  }

  getLowStockAlerts(
    threshold = 5,
    companyId?: number,
    opts?: { skip?: number; take?: number },
  ) {
    const skip = Math.max(0, Math.floor(opts?.skip ?? 0));
    const rawTake = opts?.take ?? 10;
    const take = Math.min(200, Math.max(1, Math.floor(rawTake)));

    const where = {
      trackStock: true,
      isService: false,
      // Stock bas = strictement sous le seuil (ex. seuil 5 → 0 à 4).
      stock: { lt: threshold },
      ...(companyId ? { department: { companyId } } : {}),
    };

    return Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          saleUnits: { include: { packagingUnit: true } },
          department: true,
        },
        orderBy: { stock: 'asc' },
        skip,
        take,
      }),
      this.prisma.product.count({ where }),
    ]).then(([items, total]) => ({ items, total }));
  }

  private async ensureProductExists(productId: number) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
    return product;
  }

  async createPhysicalInventorySession(
    departmentId: number,
    label: string | undefined,
    note: string | undefined,
    createdById: number | undefined,
    kind: InventorySessionKind = InventorySessionKind.AD_HOC,
  ) {
    const dept = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) {
      throw new NotFoundException('Département introuvable');
    }

    const products = await this.prisma.product.findMany({
      where: {
        departmentId,
        trackStock: true,
        isService: false,
      },
    });

    const dateLabel = new Date().toLocaleDateString('fr-FR');
    const defaultLabels: Record<InventorySessionKind, string> = {
      [InventorySessionKind.OPENING]: `Ouverture de période — ${dateLabel}`,
      [InventorySessionKind.CLOSING]: `Clôture de période — ${dateLabel}`,
      [InventorySessionKind.AD_HOC]: `Contrôle — ${dateLabel}`,
    };

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.inventorySession.create({
        data: {
          departmentId,
          kind,
          label: label?.trim() || defaultLabels[kind],
          note: note ?? null,
          createdById: createdById ?? null,
        },
      });

      if (products.length > 0) {
        await tx.inventoryLine.createMany({
          data: products.map((p) => ({
            sessionId: session.id,
            productId: p.id,
            systemQtyAtOpen: p.stock,
          })),
        });
      }

      const created = await tx.inventorySession.findUniqueOrThrow({
        where: { id: session.id },
        include: {
          department: { include: { company: true } },
          createdBy: { select: USER_ATTRIBUTION_SELECT },
          lines: {
            include: { product: true },
            orderBy: { product: { name: 'asc' } },
          },
        },
      });
      await this.auditService.log({
        userId: createdById,
        action: 'INVENTORY_SESSION_CREATED',
        entity: 'InventorySession',
        entityId: String(session.id),
        metadata: { departmentId, label: label ?? null },
      });
      return created;
    });
  }

  listInventorySessions(filters?: { departmentId?: number; companyId?: number }) {
    const where: Prisma.InventorySessionWhereInput = { deletedAt: null };
    if (filters?.departmentId) {
      where.departmentId = filters.departmentId;
    } else if (filters?.companyId) {
      where.department = { companyId: filters.companyId };
    }
    return this.prisma.inventorySession.findMany({
      where,
      include: {
        department: {
          select: {
            id: true,
            name: true,
            company: { select: { id: true, name: true } },
          },
        },
        createdBy: { select: USER_ATTRIBUTION_SELECT },
        completedBy: { select: USER_ATTRIBUTION_SELECT },
        cancelledBy: { select: USER_ATTRIBUTION_SELECT },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
    });
  }

  async listInventorySessionsForExport(
    filters?: { departmentId?: number; companyId?: number },
    take = 80,
  ) {
    const safeTake = Math.min(200, Math.max(1, Math.floor(take)));
    const where: Prisma.InventorySessionWhereInput = { deletedAt: null };
    if (filters?.departmentId) {
      where.departmentId = filters.departmentId;
    } else if (filters?.companyId) {
      where.department = { companyId: filters.companyId };
    }
    return this.prisma.inventorySession.findMany({
      where,
      include: {
        department: { include: { company: true } },
        createdBy: { select: USER_ATTRIBUTION_SELECT },
        completedBy: { select: USER_ATTRIBUTION_SELECT },
        lines: {
          include: {
            product: {
              include: {
                saleUnits: {
                  where: { isDefault: true },
                  take: 1,
                  include: { packagingUnit: true },
                },
              },
            },
          },
          orderBy: { product: { name: 'asc' } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: safeTake,
    });
  }

  async getCountSheetContext(departmentId: number) {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      include: { company: true },
    });
    if (!department) {
      throw new NotFoundException('Département introuvable');
    }
    const products = await this.prisma.product.findMany({
      where: {
        departmentId,
        trackStock: true,
        isService: false,
      },
      include: {
        saleUnits: {
          where: { isDefault: true },
          take: 1,
          include: { packagingUnit: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    return {
      generatedAt: new Date().toISOString(),
      department: {
        id: department.id,
        name: department.name,
        company: department.company,
      },
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock: Number(p.stock),
        unitLabel: this.packagingLabelFromProduct(p),
      })),
    };
  }

  private packagingLabelFromProduct(product: {
    saleUnits?: Array<{
      labelOverride: string | null;
      packagingUnit: { label: string; code: string };
    }>;
  }): string {
    const su = product.saleUnits?.[0];
    if (!su?.packagingUnit) return '—';
    const override = su.labelOverride?.trim();
    const base = override || su.packagingUnit.label;
    return `${base} (${su.packagingUnit.code})`;
  }

  async getInventorySession(id: number) {
    const s = await this.prisma.inventorySession.findUnique({
      where: { id },
      include: {
        department: { include: { company: true } },
        createdBy: { select: USER_ATTRIBUTION_SELECT },
        completedBy: { select: USER_ATTRIBUTION_SELECT },
        cancelledBy: { select: USER_ATTRIBUTION_SELECT },
        lines: {
          include: { product: true },
          orderBy: { product: { name: 'asc' } },
        },
      },
    });
    if (!s) {
      throw new NotFoundException('Session introuvable');
    }
    return s;
  }

  async updateInventoryLine(
    sessionId: number,
    lineId: number,
    dto: UpdateInventoryLineDto,
    userId?: number,
  ) {
    const line = await this.prisma.inventoryLine.findFirst({
      where: { id: lineId, sessionId },
      include: { session: true },
    });
    if (!line) {
      throw new NotFoundException('Ligne introuvable');
    }
    if (line.session.status !== InventorySessionStatus.DRAFT) {
      throw new BadRequestException('Cette session est verrouillée.');
    }

    const data: Prisma.InventoryLineUpdateInput = {};
    if (dto.countedQty !== undefined) {
      data.countedQty = dto.countedQty;
    }
    if (dto.note !== undefined) {
      data.note = dto.note;
    }

    const updated = await this.prisma.inventoryLine.update({
      where: { id: lineId },
      data,
      include: { product: true },
    });
    await this.auditService.log({
      userId,
      action: 'INVENTORY_LINE_UPDATED',
      entity: 'InventoryLine',
      entityId: String(lineId),
      metadata: { sessionId, countedQty: dto.countedQty, note: dto.note },
    });
    return updated;
  }

  async completeInventorySession(sessionId: number, userId?: number, adjustStock = false) {
    const session = await this.prisma.inventorySession.findUnique({
      where: { id: sessionId },
      include: { lines: true },
    });
    if (!session) {
      throw new NotFoundException('Session introuvable');
    }
    if (session.status !== InventorySessionStatus.DRAFT) {
      throw new BadRequestException('Cette session est déjà clôturée ou annulée.');
    }

    const hasCount = session.lines.some((l) => l.countedQty !== null);
    if (!hasCount) {
      throw new BadRequestException(
        'Saisissez au moins une quantité comptée avant validation.',
      );
    }

    const reason = `Inventaire physique #${sessionId}`;

    await this.prisma.$transaction(async (tx) => {
      if (adjustStock) {
        for (const line of session.lines) {
          if (line.countedQty === null) {
            continue;
          }
          const counted = Number(line.countedQty);
          const product = await tx.product.findUnique({ where: { id: line.productId } });
          if (!product) {
            continue;
          }
          const current = Number(product.stock);
          const delta = counted - current;
          if (delta === 0) {
            continue;
          }

          if (delta < 0) {
            const abs = Math.abs(delta);
            await this.ensureStockAvailabilityTx(tx, line.productId, abs);
            await tx.product.update({
              where: { id: line.productId },
              data: { stock: { increment: delta } },
            });
            await tx.stockMovement.create({
              data: {
                productId: line.productId,
                quantity: abs,
                type: MovementType.OUT,
                reason,
                createdById: userId,
                inventorySessionId: sessionId,
              },
            });
          } else {
            await tx.product.update({
              where: { id: line.productId },
              data: { stock: { increment: delta } },
            });
            await tx.stockMovement.create({
              data: {
                productId: line.productId,
                quantity: delta,
                type: MovementType.IN,
                reason,
                createdById: userId,
                inventorySessionId: sessionId,
              },
            });
          }
        }
      }

      await tx.inventorySession.update({
        where: { id: sessionId },
        data: {
          status: InventorySessionStatus.COMPLETED,
          completedAt: new Date(),
          ...(userId != null ? { completedBy: { connect: { id: userId } } } : {}),
        },
      });
    });

    await this.auditService.log({
      userId,
      action: 'INVENTORY_SESSION_COMPLETED',
      entity: 'InventorySession',
      entityId: String(sessionId),
      metadata: { adjustStock },
    });
    return this.getInventorySession(sessionId);
  }

  async cancelInventorySession(sessionId: number, userId?: number) {
    const session = await this.prisma.inventorySession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('Session introuvable');
    }
    if (session.status !== InventorySessionStatus.DRAFT) {
      throw new BadRequestException('Seules les sessions en brouillon peuvent être annulées.');
    }
    const cancelled = await this.prisma.inventorySession.update({
      where: { id: sessionId },
      data: {
        status: InventorySessionStatus.CANCELLED,
        ...(userId != null ? { cancelledBy: { connect: { id: userId } } } : {}),
      },
    });
    await this.auditService.log({
      userId,
      action: 'INVENTORY_SESSION_CANCELLED',
      entity: 'InventorySession',
      entityId: String(sessionId),
    });
    return cancelled;
  }

  async createRegisterInventorySession(
    departmentId: number,
    kind: InventorySessionKind,
    lines: Array<{ productId: number; countedQty: number }>,
    userId?: number,
  ) {
    const dept = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) {
      throw new NotFoundException('Département introuvable');
    }

    const products = await this.prisma.product.findMany({
      where: { departmentId, trackStock: true, isService: false },
    });
    if (products.length === 0) {
      throw new BadRequestException('Aucun produit avec stock suivi dans ce département.');
    }

    const lineMap = new Map(lines.map((l) => [l.productId, l.countedQty]));
    for (const p of products) {
      const qty = lineMap.get(p.id);
      if (qty === undefined || !Number.isFinite(qty) || qty < 0) {
        throw new BadRequestException(`Quantité manquante ou invalide pour ${p.name}.`);
      }
    }

    const dateLabel = new Date().toLocaleDateString('fr-FR');
    const defaultLabels: Record<InventorySessionKind, string> = {
      [InventorySessionKind.OPENING]: `Ouverture caisse — ${dateLabel}`,
      [InventorySessionKind.CLOSING]: `Fermeture caisse — ${dateLabel}`,
      [InventorySessionKind.AD_HOC]: `Contrôle — ${dateLabel}`,
    };

    const sessionId = await this.prisma.$transaction(async (tx) => {
      const session = await tx.inventorySession.create({
        data: {
          departmentId,
          kind,
          label: defaultLabels[kind],
          createdById: userId ?? null,
        },
      });

      await tx.inventoryLine.createMany({
        data: products.map((p) => ({
          sessionId: session.id,
          productId: p.id,
          systemQtyAtOpen: p.stock,
          countedQty: lineMap.get(p.id)!,
        })),
      });

      await tx.inventorySession.update({
        where: { id: session.id },
        data: {
          status: InventorySessionStatus.COMPLETED,
          completedAt: new Date(),
          ...(userId != null ? { completedBy: { connect: { id: userId } } } : {}),
        },
      });

      return session.id;
    });

    await this.auditService.log({
      userId,
      action: 'INVENTORY_SESSION_COMPLETED',
      entity: 'InventorySession',
      entityId: String(sessionId),
      metadata: { adjustStock: false, registerFlow: true, kind },
    });

    return this.getInventorySession(sessionId);
  }

  /**
   * Inventaire global. Si `asOf` (YYYY-MM-DD) est fourni et antérieur à aujourd’hui (Haïti),
   * reconstruit le stock à la fin de ce jour :
   * stock_au = stock_actuel − Σ mouvements postérieurs (signés IN+/OUT−/ADJUSTMENT+).
   */
  async getGlobalStockSnapshot(filters?: {
    companyIds?: number[];
    departmentIds?: number[];
    asOf?: string;
  }) {
    const where: Prisma.ProductWhereInput = {
      trackStock: true,
      isService: false,
      deletedAt: null,
    };

    if (filters?.departmentIds?.length) {
      where.departmentId = { in: filters.departmentIds };
    } else if (filters?.companyIds?.length) {
      where.companyId = { in: filters.companyIds };
    }

    const products = await this.prisma.product.findMany({
      where,
      include: {
        department: { include: { company: true } },
        saleUnits: {
          where: { isDefault: true },
          take: 1,
          include: { packagingUnit: true },
        },
      },
      orderBy: [{ company: { name: 'asc' } }, { department: { name: 'asc' } }, { name: 'asc' }],
    });

    const todayYmd = nowBusinessYmd();
    const asOfRaw = filters?.asOf?.trim() || undefined;
    let asOfYmd: string | null = null;
    let historical = false;
    let cutoff: Date | null = null;

    if (asOfRaw) {
      try {
        cutoff = ymdToBusinessDayEnd(asOfRaw);
        asOfYmd = asOfRaw.trim();
      } catch {
        throw new BadRequestException('asOf attendu au format YYYY-MM-DD');
      }
      if (asOfYmd > todayYmd) {
        throw new BadRequestException('asOf ne peut pas être une date future');
      }
      historical = asOfYmd < todayYmd;
    }

    const stockByProductId = new Map<number, number>();
    for (const p of products) {
      stockByProductId.set(p.id, Number(p.stock));
    }

    if (historical && cutoff && products.length > 0) {
      const productIds = products.map((p) => p.id);
      const movements = await this.prisma.stockMovement.findMany({
        where: {
          deletedAt: null,
          productId: { in: productIds },
          createdAt: { gt: cutoff },
        },
        select: { productId: true, type: true, quantity: true },
      });

      const deltaAfter = new Map<number, number>();
      for (const m of movements) {
        const signed = signedMovementDelta(m.type, Number(m.quantity));
        deltaAfter.set(m.productId, (deltaAfter.get(m.productId) ?? 0) + signed);
      }
      for (const id of productIds) {
        const current = stockByProductId.get(id) ?? 0;
        const delta = deltaAfter.get(id) ?? 0;
        stockByProductId.set(id, current - delta);
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      asOf: asOfYmd ?? todayYmd,
      historical,
      items: products.map((p) => {
        const stock = stockByProductId.get(p.id) ?? Number(p.stock);
        const stockMin = Number(p.stockMin);
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          stock,
          stockMin,
          company: p.department?.company ?? null,
          department: p.department
            ? { id: p.department.id, name: p.department.name }
            : null,
          unitLabel: this.packagingLabelFromProduct(p),
          lowStock: stock <= stockMin,
        };
      }),
    };
  }
}
