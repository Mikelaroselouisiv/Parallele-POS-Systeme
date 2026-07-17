import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FinanceType, MovementType, Prisma } from '@prisma/client';
import { resolveVolumeUnitPrice } from '../../common/utils/volume-unit-price';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DeliveriesService } from '../deliveries/deliveries.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesRepository } from './sales.repository';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salesRepository: SalesRepository,
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
    private readonly deliveriesService: DeliveriesService,
  ) {}

  async create(createSaleDto: CreateSaleDto, userId?: number) {
    if (createSaleDto.clientUuid) {
      const existing = await this.prisma.sale.findUnique({
        where: { clientUuid: createSaleDto.clientUuid },
        select: { id: true },
      });
      if (existing) return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      if (createSaleDto.clientUuid) {
        const raced = await tx.sale.findUnique({
          where: { clientUuid: createSaleDto.clientUuid },
          select: { id: true },
        });
        if (raced) return raced;
      }

      const saleItemsData: Prisma.SaleItemCreateWithoutSaleInput[] = [];
      let total = 0;
      let firstCompanyId: number | null = null;
      let firstDepartmentId: number | null = null;

      for (const item of createSaleDto.items) {
        const psu = await tx.productSaleUnit.findUnique({
          where: { id: item.productSaleUnitId },
          include: {
            product: true,
            packagingUnit: true,
            volumePrices: { orderBy: { minQuantity: 'asc' } },
          },
        });
        if (!psu) {
          throw new NotFoundException(`Unité de vente ${item.productSaleUnitId} introuvable`);
        }

        const product = psu.product;
        if (firstCompanyId === null) {
          firstCompanyId = product.companyId;
        }
        if (firstDepartmentId === null && product.departmentId != null) {
          firstDepartmentId = product.departmentId;
        }
        const unitsPerPackage = Number(psu.unitsPerPackage);
        const baseQuantity = unitsPerPackage * item.quantity;

        const recipe = product.isService
          ? await tx.productRecipe.findUnique({
              where: { parentProductId: product.id },
              include: { components: true },
            })
          : null;

        if (product.isService && recipe?.components.length) {
          for (const c of recipe.components) {
            const need = Number(c.quantityPerParentBaseUnit) * baseQuantity;
            await this.inventoryService.ensureStockAvailabilityTx(
              tx,
              c.componentProductId,
              need,
            );
          }
        } else if (product.trackStock && !product.isService) {
          await this.inventoryService.ensureStockAvailabilityTx(
            tx,
            product.id,
            baseQuantity,
          );
        }

        const tierRows = psu.volumePrices.map((v) => ({
          minQuantity: Number(v.minQuantity),
          unitPrice: Number(v.unitPrice),
        }));
        const unitPrice = resolveVolumeUnitPrice(Number(psu.salePrice), tierRows, item.quantity);
        const subtotal = unitPrice * item.quantity;
        total += subtotal;

        const lineLabel = psu.labelOverride
          ? `${product.name} (${psu.labelOverride})`
          : `${product.name} (${psu.packagingUnit.label})`;

        // Stock : contrôle de dispo à l’encaissement, sortie réelle à la livraison.
        saleItemsData.push({
          quantity: item.quantity,
          baseQuantity,
          unitPrice,
          subtotal,
          lineLabel,
          product: { connect: { id: product.id } },
          productSaleUnit: { connect: { id: psu.id } },
        });
      }

      const paymentTotal = createSaleDto.payments.reduce((acc, p) => acc + p.amount, 0);
      if (paymentTotal < total - 0.01) {
        throw new BadRequestException('Le montant payé est inférieur au total de la vente');
      }

      // IMPORTANT: Prisma tente actuellement d'insérer la colonne `Sale.clientName` alors que
      // la migration n'est pas forcément appliquée sur la DB. On contourne le create Prisma :
      // 1) insertion Sale via SQL brut (sans clientName)
      // 2) insertion SaleItem/Payment via Prisma (sans toucher au modèle Sale)
      // 3) update "best-effort" de clientName si la colonne existe
      const clientNameRaw =
        createSaleDto.clientName && createSaleDto.clientName.trim() ? createSaleDto.clientName.trim() : null;

      let cashier: string | null = null;
      if (userId) {
        const u = await tx.user.findUnique({
          where: { id: userId },
          select: { fullName: true, phone: true },
        });
        cashier = u?.fullName?.trim() || u?.phone?.trim() || `User#${userId}`;
      }
      const storeId = createSaleDto.storeId ?? null;
      const registerId = createSaleDto.registerId ?? null;

      const clientUuid = createSaleDto.clientUuid ?? null;
      const insertedRows = await tx.$queryRaw<Array<{ id: number }>>`
        INSERT INTO "Sale"
          ("total", "subtotal", "tax", "cashier", "userId", "storeId", "registerId", "clientUuid", "updatedAt")
        VALUES
          (${total}, ${total}, 0, ${cashier}, ${userId ?? null}, ${storeId}, ${registerId}, ${clientUuid}, NOW())
        RETURNING "id";
      `;
      const saleId = insertedRows?.[0]?.id;
      if (!saleId) throw new BadRequestException('Impossible de créer la vente.');

      await tx.saleItem.createMany({
        data: saleItemsData.map((it) => ({
          saleId,
          // saleItemsData contient déjà quantity/baseQuantity/unitPrice/subtotal/lineLabel + product/productSaleUnit connect.
          // On réutilise la structure Prisma en passant directement les champs attendus par la table.
          quantity: it.quantity as unknown as Prisma.Decimal,
          baseQuantity: it.baseQuantity as unknown as Prisma.Decimal,
          unitPrice: it.unitPrice as unknown as Prisma.Decimal,
          subtotal: it.subtotal as unknown as Prisma.Decimal,
          lineLabel: it.lineLabel ?? null,
          productId: (it.product as unknown as { connect: { id: number } }).connect.id,
          productSaleUnitId: (it.productSaleUnit as unknown as { connect: { id: number } }).connect.id,
          createdAt: new Date(),
        })),
      });

      await tx.payment.createMany({
        data: createSaleDto.payments.map((payment) => ({
          saleId,
          amount: payment.amount as unknown as Prisma.Decimal,
          method: payment.method,
          reference: payment.reference ?? null,
        })),
      });

      // Journal financier : une ligne INCOME par vente (alignée caisse / mouvements pour l’admin).
      if (firstCompanyId != null && total > 0) {
        const categoryId = await this.findOrCreateVentesPosCategoryId(tx, firstCompanyId);
        await tx.financeEntry.create({
          data: {
            type: FinanceType.INCOME,
            amount: total,
            description: `Encaissement vente #${saleId}`,
            userId: userId ?? null,
            categoryId,
            saleId,
          },
        });
      }

      if (clientNameRaw !== null) {
        try {
          await tx.$executeRaw`UPDATE "Sale" SET "clientName" = ${clientNameRaw} WHERE "id" = ${saleId}`;
        } catch {
          // Colonne non existante : on ignore pour ne pas bloquer l'encaissement.
        }
      }

      if (firstCompanyId != null) {
        const createdItems = await tx.saleItem.findMany({
          where: { saleId },
          select: { id: true, quantity: true },
          orderBy: { id: 'asc' },
        });
        if (createdItems.length) {
          await this.deliveriesService.createFromSaleTx(tx, {
            saleId,
            companyId: firstCompanyId,
            departmentId: firstDepartmentId,
            items: createdItems.map((it) => ({
              saleItemId: it.id,
              quantityOrdered: Number(it.quantity),
            })),
          });
        }
      }

      const sale = { id: saleId };
      await this.auditService.log({
        userId,
        action: 'SALE_CREATED',
        entity: 'SALE',
        entityId: String(saleId),
        metadata: { total },
      });
      return sale;
    });
  }

  findAll() {
    return this.salesRepository.findAll();
  }

  findManyPaginated(opts: {
    companyId: number;
    skip?: number;
    take?: number;
    createdAtGte?: Date;
    createdAtLte?: Date;
    departmentId?: number;
  }) {
    const skip = Math.max(0, Math.floor(opts.skip ?? 0));
    const take = Math.min(100, Math.max(1, Math.floor(opts.take ?? 10)));
    return this.salesRepository.findManyPaginated({
      companyId: opts.companyId,
      skip,
      take,
      createdAtGte: opts.createdAtGte,
      createdAtLte: opts.createdAtLte,
      departmentId: opts.departmentId,
    });
  }

  async findOne(id: number) {
    const sale = await this.salesRepository.findOne(id);
    if (!sale) {
      throw new NotFoundException('Vente introuvable');
    }
    return sale;
  }

  async cancelSale(id: number, userId?: number) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!sale) {
      throw new NotFoundException('Sale not found');
    }
    if (sale.status !== 'COMPLETED') {
      throw new BadRequestException('Only completed sales can be cancelled');
    }
    return this.prisma.$transaction(async (tx) => {
      await this.reverseDeliveredStockForSale(tx, id, userId, 'Annulation vente');
      await tx.financeEntry.deleteMany({ where: { saleId: id } });
      const updated = await tx.sale.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      await this.auditService.log({
        userId,
        action: 'SALE_CANCELLED',
        entity: 'SALE',
        entityId: String(id),
      });
      return updated;
    });
  }

  async refundSale(id: number, userId?: number) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!sale) {
      throw new NotFoundException('Sale not found');
    }
    if (sale.status !== 'COMPLETED') {
      throw new BadRequestException('Only completed sales can be refunded');
    }
    return this.prisma.$transaction(async (tx) => {
      await this.reverseDeliveredStockForSale(tx, id, userId, 'Remboursement vente');
      await tx.financeEntry.deleteMany({ where: { saleId: id } });
      const updated = await tx.sale.update({
        where: { id },
        data: { status: 'REFUNDED' },
      });
      await this.auditService.log({
        userId,
        action: 'SALE_REFUNDED',
        entity: 'SALE',
        entityId: String(id),
      });
      return updated;
    });
  }

  /**
   * Suppression définitive (admin uniquement) : rétablit le stock si la vente était encore complétée,
   * supprime l’écriture de caisse liée, puis la vente (lignes et paiements en cascade).
   */
  async deleteSalePermanently(saleId: number, adminUserId?: number, companyId?: number) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: { include: { product: true } } },
    });
    if (!sale) {
      throw new NotFoundException('Vente introuvable');
    }
    if (companyId != null && companyId > 0) {
      const mismatch = sale.items.some((i) => i.product.companyId !== companyId);
      if (mismatch) {
        throw new BadRequestException("Cette vente n'appartient pas à l'entreprise sélectionnée.");
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (sale.status === 'COMPLETED' && sale.items.length > 0) {
        await this.reverseDeliveredStockForSale(
          tx,
          saleId,
          adminUserId,
          'Suppression vente (admin)',
        );
      }
      await tx.financeEntry.deleteMany({ where: { saleId } });
      await tx.sale.delete({ where: { id: saleId } });
      await this.auditService.log({
        userId: adminUserId,
        action: 'SALE_DELETED_PERMANENTLY',
        entity: 'SALE',
        entityId: String(saleId),
        metadata: { previousStatus: sale.status },
      });
      return { ok: true, id: saleId };
    });
  }

  private async findOrCreateVentesPosCategoryId(tx: Prisma.TransactionClient, companyId: number) {
    const name = 'Ventes POS';
    const existing = await tx.expenseCategory.findFirst({
      where: { companyId, name },
    });
    if (existing) return existing.id;
    const created = await tx.expenseCategory.create({
      data: { companyId, name },
    });
    return created.id;
  }

  /**
   * Ré-entrée stock uniquement pour la part déjà livrée (la sortie se fait à la livraison).
   */
  private async reverseDeliveredStockForSale(
    tx: Prisma.TransactionClient,
    saleId: number,
    userId: number | undefined,
    reasonPrefix: string,
  ) {
    const delivery = await tx.delivery.findUnique({
      where: { saleId },
      include: {
        items: {
          include: {
            saleItem: {
              select: {
                productId: true,
                quantity: true,
                baseQuantity: true,
                product: { select: { id: true, name: true, trackStock: true, isService: true } },
              },
            },
          },
        },
      },
    });
    if (!delivery) return;

    for (const di of delivery.items) {
      const deliveredQty = Number(di.quantityDelivered);
      if (deliveredQty <= 0.0001) continue;
      const saleQty = Number(di.saleItem.quantity);
      const baseFull = Number(di.saleItem.baseQuantity);
      if (saleQty <= 0) continue;
      const baseQty = (deliveredQty / saleQty) * baseFull;
      if (baseQty <= 0.0001) continue;

      const product = di.saleItem.product;
      if (product.isService) {
        const recipe = await tx.productRecipe.findUnique({
          where: { parentProductId: product.id },
          include: { components: true },
        });
        if (recipe?.components.length) {
          for (const c of recipe.components) {
            const qty = Number(c.quantityPerParentBaseUnit) * baseQty;
            await tx.product.update({
              where: { id: c.componentProductId },
              data: { stock: { increment: qty } },
            });
            await tx.stockMovement.create({
              data: {
                productId: c.componentProductId,
                quantity: qty,
                type: MovementType.IN,
                reason: `${reasonPrefix} #${saleId} (recette ${product.name})`,
                createdById: userId,
              },
            });
          }
        }
      } else if (product.trackStock) {
        await tx.product.update({
          where: { id: product.id },
          data: { stock: { increment: baseQty } },
        });
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            quantity: baseQty,
            type: MovementType.IN,
            reason: `${reasonPrefix} #${saleId}`,
            createdById: userId,
          },
        });
      }
    }
  }

  /** PDF côté serveur (pdfkit), même principe que l’export inventaires. */
  async buildSalePdf(id: number): Promise<Buffer> {
    const sale = await this.salesRepository.findOne(id);
    if (!sale) {
      throw new NotFoundException('Vente introuvable');
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const fmt = (n: unknown) => Number(n ?? 0).toFixed(2);
    const fmtQty = (n: unknown) => Number(n ?? 0).toFixed(3);

    doc.fontSize(18).text(`Vente #${sale.id}`, { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Date: ${new Date(sale.createdAt).toLocaleString('fr-FR')}`);
    doc.fontSize(11).text(`Statut: ${sale.status}`);
    if (sale.clientName?.trim()) {
      doc.fontSize(11).text(`Client: ${sale.clientName.trim()}`);
    }
    const cashier =
      sale.user?.fullName?.trim() || sale.cashier || sale.user?.phone || '—';
    doc.fontSize(11).text(`Caissier: ${cashier}`);
    doc.moveDown();

    doc.fontSize(12).text('Articles');
    doc.moveDown(0.25);
    for (const line of sale.items ?? []) {
      const label = line.lineLabel ?? line.product?.name ?? 'Article';
      doc
        .fontSize(10)
        .text(
          `• ${label} — Qté ${fmtQty(line.quantity)} × ${fmt(line.unitPrice)} = ${fmt(line.subtotal)}`,
        );
    }
    doc.moveDown();
    doc.fontSize(12).text(`Total: ${fmt(sale.total)}`);

    if (sale.payments?.length) {
      doc.moveDown();
      doc.fontSize(12).text('Paiements');
      doc.moveDown(0.25);
      for (const p of sale.payments) {
        doc.fontSize(10).text(`${p.method}: ${fmt(p.amount)}`);
      }
    }

    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }
}
