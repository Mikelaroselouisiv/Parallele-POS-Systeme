import { BadRequestException, Injectable } from '@nestjs/common';
import { FinanceType, GoodsReceiptStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CloseCashDto, CreateFinanceEntryDto } from './dto/finance-entry.dto';

export type FinanceLedgerNature = 'all' | 'purchase' | 'sale' | 'expense';

export type FinanceLedgerRow = {
  kind: 'PURCHASE' | 'SALE' | 'EXPENSE';
  id: string;
  occurredAt: string;
  amount: number;
  description: string;
  user: { id: number; fullName: string | null; phone: string } | null;
};

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  private ymdToDateStart(ymd: string): Date {
    const [y, m, d] = ymd.split('-').map((x) => Number.parseInt(x, 10));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
      throw new BadRequestException('Date invalide');
    }
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  private ymdToDateEnd(ymd: string): Date {
    const [y, m, d] = ymd.split('-').map((x) => Number.parseInt(x, 10));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
      throw new BadRequestException('Date invalide');
    }
    return new Date(y, m - 1, d, 23, 59, 59, 999);
  }

  /** Date « jour » pour une entrée créée manuellement (midi local pour limiter les dérives fuseau). */
  private entryDateFromYmd(ymd: string): Date {
    const [y, m, d] = ymd.split('-').map((x) => Number.parseInt(x, 10));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
      throw new BadRequestException('entryDate invalide');
    }
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }

  private companyFinanceWhere(companyId: number): Prisma.FinanceEntryWhereInput {
    return {
      OR: [
        { category: { companyId } },
        { categoryId: null, user: { companyId } },
        { categoryId: null, user: { companyId: null } },
      ],
    };
  }

  async journal(opts?: { companyId?: number; skip?: number; take?: number }) {
    const skip = Math.max(0, Math.floor(opts?.skip ?? 0));
    const rawTake = opts?.take ?? 30;
    const take = Math.min(200, Math.max(1, Math.floor(rawTake)));

    const companyFilter =
      opts?.companyId != null ? this.companyFinanceWhere(opts.companyId) : undefined;

    const where: Prisma.FinanceEntryWhereInput | undefined = companyFilter
      ? { type: { in: [FinanceType.INCOME, FinanceType.EXPENSE] }, ...companyFilter }
      : undefined;

    const [items, total] = await Promise.all([
      this.prisma.financeEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          user: { select: { id: true, fullName: true, phone: true } },
        },
      }),
      this.prisma.financeEntry.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Journal unifié : réceptions d’achat (POSTED), encaissements vente (INCOME), dépenses manuelles (EXPENSE).
   */
  async ledger(opts: {
    companyId: number;
    dateFrom: string;
    dateTo: string;
    nature?: FinanceLedgerNature;
    skip?: number;
    take?: number;
  }): Promise<{ items: FinanceLedgerRow[]; total: number }> {
    const from = this.ymdToDateStart(opts.dateFrom);
    const to = this.ymdToDateEnd(opts.dateTo);
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('dateFrom doit être antérieure ou égale à dateTo');
    }

    const nature: FinanceLedgerNature = opts.nature ?? 'all';
    const skip = Math.max(0, Math.floor(opts.skip ?? 0));
    const rawTake = opts.take ?? 30;
    const take = Math.min(200, Math.max(1, Math.floor(rawTake)));

    const companyId = opts.companyId;
    const rows: FinanceLedgerRow[] = [];

    const wantPurchase = nature === 'all' || nature === 'purchase';
    const wantSale = nature === 'all' || nature === 'sale';
    const wantExpense = nature === 'all' || nature === 'expense';

    if (wantPurchase) {
      const receipts = await this.prisma.goodsReceipt.findMany({
        where: {
          status: GoodsReceiptStatus.POSTED,
          receivedAt: { gte: from, lte: to },
          department: { companyId },
        },
        include: {
          lines: true,
          createdBy: { select: { id: true, fullName: true, phone: true } },
        },
      });
      for (const gr of receipts) {
        const amount = gr.lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unitCost), 0);
        const note = gr.note?.trim();
        rows.push({
          kind: 'PURCHASE',
          id: `gr-${gr.id}`,
          occurredAt: gr.receivedAt.toISOString(),
          amount,
          description: note ? `${note} (#${gr.id})` : `Réception achat #${gr.id}`,
          user: gr.createdBy,
        });
      }
    }

    if (wantSale || wantExpense) {
      const types: FinanceType[] = [];
      if (wantSale) types.push(FinanceType.INCOME);
      if (wantExpense) types.push(FinanceType.EXPENSE);
      const entries = await this.prisma.financeEntry.findMany({
        where: {
          type: { in: types },
          createdAt: { gte: from, lte: to },
          ...this.companyFinanceWhere(companyId),
        },
        include: {
          user: { select: { id: true, fullName: true, phone: true } },
        },
      });
      for (const fe of entries) {
        if (fe.type === FinanceType.INCOME) {
          rows.push({
            kind: 'SALE',
            id: `fe-${fe.id}`,
            occurredAt: fe.createdAt.toISOString(),
            amount: Number(fe.amount),
            description: fe.description,
            user: fe.user,
          });
        } else {
          rows.push({
            kind: 'EXPENSE',
            id: `fe-${fe.id}`,
            occurredAt: fe.createdAt.toISOString(),
            amount: Number(fe.amount),
            description: fe.description,
            user: fe.user,
          });
        }
      }
    }

    rows.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
    const total = rows.length;
    const page = rows.slice(skip, skip + take);
    return { items: page, total };
  }

  async createEntry(dto: CreateFinanceEntryDto, userId?: number) {
    const companyId =
      dto.companyId ??
      (userId != null
        ? (await this.prisma.user.findUnique({ where: { id: userId }, select: { companyId: true } }))
            ?.companyId
        : null);

    // Dépenses manuelles : une des sorties du tableau de bord (avec achats reçus) ; revenus = ventes.
    // If no company can be inferred, we still allow create (categoryId stays null).
    const categoryName = 'Dépenses manuelles';
    let categoryId: number | null = null;

    if (companyId != null) {
      const existing = await this.prisma.expenseCategory.findFirst({
        where: { companyId, name: categoryName },
      });
      if (existing) categoryId = existing.id;
      else {
        const created = await this.prisma.expenseCategory.create({
          data: { companyId, name: categoryName },
        });
        categoryId = created.id;
      }
    }

    const createdAt = dto.entryDate ? this.entryDateFromYmd(dto.entryDate) : undefined;

    return this.prisma.financeEntry.create({
      data: {
        type: dto.type,
        amount: dto.amount,
        description: dto.description,
        userId,
        categoryId,
        ...(createdAt != null ? { createdAt } : {}),
      },
    });
  }

  closeCash(dto: CloseCashDto, userId?: number) {
    const variance = dto.countedAmount - dto.expectedAmount;
    return this.prisma.cashClosure.create({
      data: {
        registerId: dto.registerId,
        expectedAmount: dto.expectedAmount,
        countedAmount: dto.countedAmount,
        variance,
        createdById: userId,
      },
    });
  }
}
