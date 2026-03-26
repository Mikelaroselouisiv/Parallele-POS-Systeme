import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  GoodsReceiptStatus,
  MovementType,
  PurchaseOrderStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateGoodsReceiptDto, CreatePurchaseOrderDto } from './dto/purchasing.dto';

@Injectable()
export class PurchasingService {
  constructor(private readonly prisma: PrismaService) {}

  listPurchaseOrders(companyId?: number) {
    return this.prisma.purchaseOrder.findMany({
      where: companyId ? { companyId } : undefined,
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getPurchaseOrder(id: number) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        department: true,
        lines: { include: { product: true } },
        goodsReceipts: { select: { id: true, status: true, receivedAt: true } },
      },
    });
    if (!po) {
      throw new NotFoundException('Bon de commande introuvable');
    }
    return po;
  }

  async createPurchaseOrder(dto: CreatePurchaseOrderDto, createdById?: number) {
    const dept = await this.prisma.department.findUnique({
      where: { id: dto.departmentId },
    });
    if (!dept || dept.companyId !== dto.companyId) {
      throw new BadRequestException('Département invalide pour cette entreprise');
    }
    const productIds = [...new Set(dto.lines.map((l) => l.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, companyId: dto.companyId },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('Un ou plusieurs produits sont invalides');
    }
    for (const p of products) {
      if (p.departmentId !== dto.departmentId) {
        throw new BadRequestException(
          `Le produit « ${p.name} » doit appartenir au même département que le bon.`,
        );
      }
    }

    return this.prisma.purchaseOrder.create({
      data: {
        companyId: dto.companyId,
        departmentId: dto.departmentId,
        supplierName: dto.supplierName ?? null,
        reference: dto.reference ?? null,
        note: dto.note ?? null,
        createdById: createdById ?? null,
        status: PurchaseOrderStatus.ORDERED,
        lines: {
          create: dto.lines.map((l) => ({
            productId: l.productId,
            quantityOrdered: l.quantityOrdered,
            unitPriceEst: l.unitPriceEst ?? null,
          })),
        },
      },
      include: { lines: { include: { product: true } }, department: true },
    });
  }

  listGoodsReceipts(departmentId?: number) {
    return this.prisma.goodsReceipt.findMany({
      where: departmentId ? { departmentId } : undefined,
      include: {
        department: { select: { id: true, name: true, companyId: true } },
        _count: { select: { lines: true } },
        purchaseOrder: { select: { id: true, reference: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getGoodsReceipt(id: number) {
    const gr = await this.prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        department: { include: { company: true } },
        lines: { include: { product: true } },
        purchaseOrder: true,
      },
    });
    if (!gr) {
      throw new NotFoundException('Réception introuvable');
    }
    return gr;
  }

  async createGoodsReceipt(dto: CreateGoodsReceiptDto, createdById?: number) {
    const dept = await this.prisma.department.findUnique({
      where: { id: dto.departmentId },
      include: { company: true },
    });
    if (!dept) {
      throw new BadRequestException('Département introuvable');
    }

    if (dto.purchaseOrderId != null) {
      const po = await this.prisma.purchaseOrder.findUnique({
        where: { id: dto.purchaseOrderId },
      });
      if (!po || po.departmentId !== dto.departmentId) {
        throw new BadRequestException('Bon de commande incompatible avec ce département');
      }
    }

    const productIds = [...new Set(dto.lines.map((l) => l.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, companyId: dept.companyId },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('Un ou plusieurs produits sont invalides');
    }
    for (const p of products) {
      if (p.departmentId !== dto.departmentId) {
        throw new BadRequestException(
          `Le produit « ${p.name} » doit appartenir au département de la réception.`,
        );
      }
      if (!p.trackStock) {
        throw new BadRequestException(
          `Le produit « ${p.name} » ne suit pas le stock — impossible à réceptionner.`,
        );
      }
    }

    return this.prisma.goodsReceipt.create({
      data: {
        departmentId: dto.departmentId,
        purchaseOrderId: dto.purchaseOrderId ?? null,
        note: dto.note ?? null,
        createdById: createdById ?? null,
        status: GoodsReceiptStatus.DRAFT,
        lines: {
          create: dto.lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitCost: l.unitCost,
          })),
        },
      },
      include: { lines: { include: { product: true } }, department: true },
    });
  }

  /** Poste la réception : entrées stock + coût moyen pondéré. */
  async postGoodsReceipt(id: number, userId?: number) {
    const gr = await this.prisma.goodsReceipt.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!gr) {
      throw new NotFoundException('Réception introuvable');
    }
    if (gr.status !== GoodsReceiptStatus.DRAFT) {
      throw new BadRequestException('Cette réception est déjà postée.');
    }

    return this.prisma.$transaction(async (tx) => {
      for (const line of gr.lines) {
        const product = await tx.product.findUnique({ where: { id: line.productId } });
        if (!product) {
          throw new BadRequestException(`Produit ${line.productId} introuvable`);
        }
        if (!product.trackStock) {
          throw new BadRequestException(`Produit ${product.name} : stock non suivi`);
        }
        if (product.departmentId !== gr.departmentId) {
          throw new BadRequestException(`Produit ${product.name} : mauvais département`);
        }

        const inQty = Number(line.quantity);
        const inCost = Number(line.unitCost);
        const oldStock = Number(product.stock);
        const oldCost = Number(product.cost);
        const newStock = oldStock + inQty;
        const newCost =
          newStock > 0 ? (oldStock * oldCost + inQty * inCost) / newStock : inCost;

        await tx.product.update({
          where: { id: product.id },
          data: {
            stock: { increment: inQty },
            cost: newCost,
          },
        });
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            quantity: inQty,
            type: MovementType.IN,
            reason: `Réception achat #${gr.id}`,
            createdById: userId,
            goodsReceiptId: gr.id,
          },
        });
      }

      await tx.goodsReceipt.update({
        where: { id: gr.id },
        data: { status: GoodsReceiptStatus.POSTED },
      });

      return tx.goodsReceipt.findUniqueOrThrow({
        where: { id: gr.id },
        include: {
          lines: { include: { product: true } },
          department: true,
          purchaseOrder: true,
        },
      });
    });
  }
}
