import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SyncPushDto, SyncRecordDto } from './dto/sync.dto';
import {
  APPEND_ONLY_ENTITIES,
  isSyncEntity,
  SYNC_ENTITIES,
  type SyncEntityName,
} from './sync.entities';
import { ENTITY_FK_MAP, RELATION_OBJECT_KEYS } from './sync-fk';

type Delegate = {
  findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
  findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
  findFirst?: (args: unknown) => Promise<Record<string, unknown> | null>;
  create: (args: unknown) => Promise<Record<string, unknown>>;
  update: (args: unknown) => Promise<Record<string, unknown>>;
};

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  listEntities() {
    return [...SYNC_ENTITIES];
  }

  async pull(entity: string, since?: string, take = 200) {
    if (!isSyncEntity(entity)) {
      throw new BadRequestException(`Entité sync inconnue: ${entity}`);
    }
    const limit = Math.min(Math.max(take || 200, 1), 1000);
    const sinceDate = since ? new Date(since) : new Date(0);
    if (Number.isNaN(sinceDate.getTime())) {
      throw new BadRequestException('since invalide (ISO 8601 attendu)');
    }

    const timeField = entity === 'AuditLog' ? 'createdAt' : 'updatedAt';
    const rows = await this.delegate(entity).findMany({
      where: {
        [timeField]: { gt: sinceDate },
      },
      orderBy: { [timeField]: 'asc' },
      take: limit,
    });

    const records: Array<{
      uuid: string;
      updatedAt?: string;
      deletedAt: string | null;
      data: Record<string, unknown>;
    }> = [];
    for (const row of rows) {
      records.push(await this.toSyncRecord(entity, row));
    }
    const last = rows[rows.length - 1];
    const nextCursor =
      last && last[timeField]
        ? new Date(String(last[timeField])).toISOString()
        : sinceDate.toISOString();

    return { entity, records, nextCursor, count: records.length };
  }

  async push(dto: SyncPushDto) {
    if (!isSyncEntity(dto.entity)) {
      throw new BadRequestException(`Entité sync inconnue: ${dto.entity}`);
    }
    const entity = dto.entity;
    const results: Array<{
      uuid: string;
      action: 'created' | 'updated' | 'skipped' | 'error';
      error?: string;
    }> = [];

    for (const record of dto.records) {
      try {
        const action = await this.applyRecord(entity, record);
        results.push({ uuid: record.uuid, action });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Push ${entity}/${record.uuid}: ${message}`);
        results.push({ uuid: record.uuid, action: 'error', error: message });
      }
    }

    return {
      entity,
      sourceNodeId: dto.sourceNodeId ?? null,
      results,
      applied: results.filter((r) => r.action === 'created' || r.action === 'updated').length,
      skipped: results.filter((r) => r.action === 'skipped').length,
      errors: results.filter((r) => r.action === 'error').length,
    };
  }

  /**
   * Instant effectif LWW : max(updatedAt, deletedAt).
   * Une suppression soft plus récente gagne sur une édition plus ancienne (et l’inverse).
   */
  private effectiveWriteAt(row: {
    updatedAt?: unknown;
    deletedAt?: unknown;
  }): Date {
    const updated = row.updatedAt ? new Date(String(row.updatedAt)) : new Date(0);
    if (Number.isNaN(updated.getTime())) {
      return new Date(0);
    }
    if (!row.deletedAt) return updated;
    const deleted = new Date(String(row.deletedAt));
    if (Number.isNaN(deleted.getTime())) return updated;
    return deleted > updated ? deleted : updated;
  }

  private async applyRecord(
    entity: SyncEntityName,
    record: SyncRecordDto,
  ): Promise<'created' | 'updated' | 'skipped'> {
    if (!record.uuid?.trim()) {
      throw new BadRequestException('uuid requis');
    }

    const existing = await this.delegate(entity).findUnique({
      where: { uuid: record.uuid },
    });

    if (APPEND_ONLY_ENTITIES.has(entity)) {
      if (existing) return 'skipped';
      await this.createFromSync(entity, record);
      return 'created';
    }

    const incomingAt = this.effectiveWriteAt({
      updatedAt: record.updatedAt ?? new Date().toISOString(),
      deletedAt: record.deletedAt,
    });
    if (existing) {
      const existingAt = this.effectiveWriteAt(existing);
      if (incomingAt <= existingAt) {
        return 'skipped';
      }
      await this.updateFromSync(entity, record);
      return 'updated';
    }

    await this.createFromSync(entity, record);
    return 'created';
  }

  private async createFromSync(entity: SyncEntityName, record: SyncRecordDto) {
    const data = await this.sanitizePayload(entity, record);
    await this.delegate(entity).create({ data });
  }

  private async updateFromSync(entity: SyncEntityName, record: SyncRecordDto) {
    const data = await this.sanitizePayload(entity, record);
    delete data.uuid;
    await this.delegate(entity).update({
      where: { uuid: record.uuid },
      data,
    });
  }

  /**
   * Payload sync : scalaires + uuid/timestamps + FK résolues via *Uuid → id local.
   */
  private async sanitizePayload(
    entity: SyncEntityName,
    record: SyncRecordDto,
  ): Promise<Record<string, unknown>> {
    const raw: Record<string, unknown> = { ...record.data };
    raw.uuid = record.uuid;

    // AuditLog n’a que createdAt (pas updatedAt / deletedAt).
    if (entity === 'AuditLog') {
      delete raw.updatedAt;
      delete raw.deletedAt;
      if (record.updatedAt && !raw.createdAt) {
        raw.createdAt = new Date(record.updatedAt);
      } else if (typeof raw.createdAt === 'string') {
        raw.createdAt = new Date(raw.createdAt);
      }
    } else {
      if (record.updatedAt) raw.updatedAt = new Date(record.updatedAt);
      if (record.deletedAt === null) raw.deletedAt = null;
      else if (record.deletedAt) raw.deletedAt = new Date(record.deletedAt);
    }

    delete raw.id;
    for (const key of RELATION_OBJECT_KEYS) {
      delete raw[key];
    }

    await this.resolveForeignKeys(entity, raw);
    return raw;
  }

  /** Remplace les Int source par les ids locaux via les uuid parents. */
  private async resolveForeignKeys(
    entity: SyncEntityName,
    data: Record<string, unknown>,
  ): Promise<void> {
    const refs = ENTITY_FK_MAP[entity] ?? [];
    for (const ref of refs) {
      const legacyId = data[ref.idField];
      // Jamais laisser l’Int source tel quel sans contrôle.
      delete data[ref.idField];

      const uuidVal = data[ref.uuidField];
      delete data[ref.uuidField];

      if (uuidVal != null && uuidVal !== '') {
        const parent = await this.delegate(ref.parent).findUnique({
          where: { uuid: String(uuidVal) },
        });
        if (!parent?.id) {
          if (ref.required) {
            throw new BadRequestException(
              `Parent ${ref.parent} introuvable (uuid=${uuidVal}) pour ${entity}`,
            );
          }
          data[ref.idField] = null;
          continue;
        }
        data[ref.idField] = Number(parent.id);
        continue;
      }

      // Compat payloads anciens (avant enrich *Uuid) : tenter l’id local si la ligne existe.
      if (legacyId != null && legacyId !== '') {
        const parentById = await this.delegate(ref.parent).findUnique({
          where: { id: Number(legacyId) },
        });
        if (parentById?.id) {
          data[ref.idField] = Number(parentById.id);
          continue;
        }
      }

      if (ref.required) {
        throw new BadRequestException(
          `FK requise manquante: ${ref.uuidField} pour ${entity}`,
        );
      }
      data[ref.idField] = null;
    }

    // Nettoyer tout *Uuid résiduel non mappé
    for (const key of Object.keys(data)) {
      if (key.endsWith('Uuid') && key !== 'uuid' && key !== 'clientUuid') {
        delete data[key];
      }
    }
  }

  private async toSyncRecord(entity: SyncEntityName, row: Record<string, unknown>) {
    const { id: _id, ...rest } = row;
    const uuid = String(row.uuid ?? '');
    const updatedAt =
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : row.updatedAt
          ? String(row.updatedAt)
          : row.createdAt instanceof Date
            ? row.createdAt.toISOString()
            : undefined;
    const deletedAt =
      row.deletedAt instanceof Date
        ? row.deletedAt.toISOString()
        : row.deletedAt
          ? String(row.deletedAt)
          : null;

    const data = this.serializeRow(rest);
    for (const key of RELATION_OBJECT_KEYS) {
      delete data[key];
    }
    await this.enrichParentUuids(entity, row, data);

    return {
      uuid,
      updatedAt,
      deletedAt,
      data,
    };
  }

  /** Ajoute companyUuid / departmentUuid / … et retire les Int FK du payload filaire. */
  private async enrichParentUuids(
    entity: SyncEntityName,
    row: Record<string, unknown>,
    data: Record<string, unknown>,
  ): Promise<void> {
    const refs = ENTITY_FK_MAP[entity] ?? [];
    for (const ref of refs) {
      const idVal = row[ref.idField];
      delete data[ref.idField];
      if (idVal == null || idVal === '') {
        data[ref.uuidField] = null;
        continue;
      }
      try {
        const parent = await this.delegate(ref.parent).findUnique({
          where: { id: Number(idVal) },
        });
        data[ref.uuidField] = parent?.uuid ? String(parent.uuid) : null;
      } catch {
        data[ref.uuidField] = null;
      }
    }
  }

  private serializeRow(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v instanceof Date) out[k] = v.toISOString();
      else if (v instanceof Prisma.Decimal) out[k] = v.toString();
      else if (typeof v === 'bigint') out[k] = Number(v);
      else if (v !== null && typeof v === 'object') continue;
      else out[k] = v;
    }
    return out;
  }

  private delegate(entity: SyncEntityName): Delegate {
    const map: Record<SyncEntityName, Delegate> = {
      Company: this.prisma.company as unknown as Delegate,
      Department: this.prisma.department as unknown as Delegate,
      DepartmentPrinterProfile: this.prisma.departmentPrinterProfile as unknown as Delegate,
      PackagingUnit: this.prisma.packagingUnit as unknown as Delegate,
      Store: this.prisma.store as unknown as Delegate,
      Register: this.prisma.register as unknown as Delegate,
      Product: this.prisma.product as unknown as Delegate,
      ProductSaleUnit: this.prisma.productSaleUnit as unknown as Delegate,
      ProductVolumePrice: this.prisma.productVolumePrice as unknown as Delegate,
      ProductRecipe: this.prisma.productRecipe as unknown as Delegate,
      RecipeComponent: this.prisma.recipeComponent as unknown as Delegate,
      User: this.prisma.user as unknown as Delegate,
      Sale: this.prisma.sale as unknown as Delegate,
      SaleItem: this.prisma.saleItem as unknown as Delegate,
      Payment: this.prisma.payment as unknown as Delegate,
      StockMovement: this.prisma.stockMovement as unknown as Delegate,
      FinanceEntry: this.prisma.financeEntry as unknown as Delegate,
      ExpenseCategory: this.prisma.expenseCategory as unknown as Delegate,
      InventorySession: this.prisma.inventorySession as unknown as Delegate,
      InventoryLine: this.prisma.inventoryLine as unknown as Delegate,
      PurchaseOrder: this.prisma.purchaseOrder as unknown as Delegate,
      PurchaseOrderLine: this.prisma.purchaseOrderLine as unknown as Delegate,
      GoodsReceipt: this.prisma.goodsReceipt as unknown as Delegate,
      GoodsReceiptLine: this.prisma.goodsReceiptLine as unknown as Delegate,
      CashClosure: this.prisma.cashClosure as unknown as Delegate,
      AuditLog: this.prisma.auditLog as unknown as Delegate,
    };
    return map[entity];
  }
}
