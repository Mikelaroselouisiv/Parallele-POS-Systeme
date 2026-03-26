import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InventorySessionStatus, MovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpdateInventoryLineDto } from './dto/physical-inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.stockMovement.create({
      data: {
        productId,
        quantity,
        type: MovementType.IN,
        reason: reason ?? 'Stock entry',
        createdById,
      },
      include: { product: true },
    });
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
    return this.prisma.stockMovement.create({
      data: {
        productId,
        quantity: abs,
        type: quantity < 0 ? MovementType.OUT : MovementType.ADJUSTMENT,
        reason: reason ?? (quantity < 0 ? 'Sortie manuelle' : 'Ajustement manuel'),
        createdById,
      },
      include: { product: true },
    });
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
    createdBy: { select: { id: true, email: true } },
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
    /** Tri par date : plus récent d'abord (défaut) ou plus ancien d'abord. */
    order?: 'asc' | 'desc';
  }) {
    const skip = Math.max(0, Math.floor(opts?.skip ?? 0));
    const rawTake = opts?.take ?? 100;
    const take = Math.min(500, Math.max(1, Math.floor(rawTake)));
    const orderDir = opts?.order === 'asc' ? 'asc' : 'desc';

    const where = opts?.companyId
      ? {
          product: {
            companyId: opts.companyId,
          },
        }
      : undefined;

    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        include: this.movementsInclude,
        orderBy: { createdAt: orderDir },
        skip,
        take,
        where,
      }),
      this.prisma.stockMovement.count({ where }),
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
      stock: { lte: threshold },
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

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.inventorySession.create({
        data: {
          departmentId,
          label: label ?? null,
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

      return tx.inventorySession.findUniqueOrThrow({
        where: { id: session.id },
        include: {
          department: { include: { company: true } },
          lines: {
            include: { product: true },
            orderBy: { product: { name: 'asc' } },
          },
        },
      });
    });
  }

  listInventorySessions(departmentId?: number) {
    return this.prisma.inventorySession.findMany({
      where: departmentId ? { departmentId } : undefined,
      include: {
        department: {
          select: {
            id: true,
            name: true,
            company: { select: { id: true, name: true } },
          },
        },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
    });
  }

  async listInventorySessionsForExport(departmentId?: number, take = 80) {
    const safeTake = Math.min(200, Math.max(1, Math.floor(take)));
    return this.prisma.inventorySession.findMany({
      where: departmentId ? { departmentId } : undefined,
      include: {
        department: { include: { company: true } },
        lines: {
          include: { product: true },
          orderBy: { product: { name: 'asc' } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: safeTake,
    });
  }

  async getInventorySession(id: number) {
    const s = await this.prisma.inventorySession.findUnique({
      where: { id },
      include: {
        department: { include: { company: true } },
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

    return this.prisma.inventoryLine.update({
      where: { id: lineId },
      data,
      include: { product: true },
    });
  }

  async completeInventorySession(sessionId: number, userId?: number) {
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

      await tx.inventorySession.update({
        where: { id: sessionId },
        data: {
          status: InventorySessionStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    });

    return this.getInventorySession(sessionId);
  }

  async cancelInventorySession(sessionId: number) {
    const session = await this.prisma.inventorySession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('Session introuvable');
    }
    if (session.status !== InventorySessionStatus.DRAFT) {
      throw new BadRequestException('Seules les sessions en brouillon peuvent être annulées.');
    }
    return this.prisma.inventorySession.update({
      where: { id: sessionId },
      data: { status: InventorySessionStatus.CANCELLED },
    });
  }
}
