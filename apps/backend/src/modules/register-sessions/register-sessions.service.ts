import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventorySessionKind, RegisterSessionStatus } from '@prisma/client';
import { USER_ATTRIBUTION_SELECT } from '../../common/user-attribution';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import type { CloseRegisterSessionDto, OpenRegisterSessionDto } from './dto/register-session.dto';

const SESSION_INCLUDE = {
  register: { include: { store: true } },
  department: { include: { company: true } },
  openedBy: { select: USER_ATTRIBUTION_SELECT },
  closedBy: { select: USER_ATTRIBUTION_SELECT },
  openingInventorySession: {
    include: {
      lines: { include: { product: true }, orderBy: { product: { name: 'asc' } } },
    },
  },
  closingInventorySession: {
    include: {
      lines: { include: { product: true }, orderBy: { product: { name: 'asc' } } },
    },
  },
} as const;

@Injectable()
export class RegisterSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
  ) {}

  listRegisters(companyId?: number) {
    return this.prisma.register.findMany({
      where: companyId
        ? { store: { companyId }, deletedAt: null }
        : { deletedAt: null },
      include: { store: true },
      orderBy: { code: 'asc' },
    });
  }

  async ensureDefaultRegister(companyId: number) {
    const existing = await this.prisma.register.findFirst({
      where: { store: { companyId }, deletedAt: null },
      include: { store: true },
    });
    if (existing) return existing;

    const store = await this.prisma.store.create({
      data: { companyId, name: 'Principal', address: '' },
    });
    return this.prisma.register.create({
      data: { storeId: store.id, code: `CAISSE-${companyId}` },
      include: { store: true },
    });
  }

  getActiveSessionForUser(userId: number) {
    return this.prisma.registerSession.findFirst({
      where: { openedById: userId, status: RegisterSessionStatus.OPEN, deletedAt: null },
      include: SESSION_INCLUDE,
      orderBy: { openedAt: 'desc' },
    });
  }

  getOpenSessionForRegister(registerId: number) {
    return this.prisma.registerSession.findFirst({
      where: { registerId, status: RegisterSessionStatus.OPEN, deletedAt: null },
      include: SESSION_INCLUDE,
    });
  }

  listSessions(filters?: {
    companyId?: number;
    registerId?: number;
    status?: RegisterSessionStatus;
    take?: number;
  }) {
    const take = Math.min(100, Math.max(1, filters?.take ?? 50));
    const where: {
      deletedAt: null;
      registerId?: number;
      status?: RegisterSessionStatus;
      department?: { companyId: number };
    } = { deletedAt: null };

    if (filters?.registerId) where.registerId = filters.registerId;
    if (filters?.status) where.status = filters.status;
    if (filters?.companyId) {
      where.department = { companyId: filters.companyId };
    }

    return this.prisma.registerSession.findMany({
      where,
      include: SESSION_INCLUDE,
      orderBy: { openedAt: 'desc' },
      take,
    });
  }

  getSession(id: number) {
    return this.prisma.registerSession.findFirst({
      where: { id, deletedAt: null },
      include: SESSION_INCLUDE,
    });
  }

  async openSession(dto: OpenRegisterSessionDto, userId: number) {
    const dept = await this.prisma.department.findUnique({
      where: { id: dto.departmentId },
    });
    if (!dept) {
      throw new NotFoundException('Département introuvable');
    }

    const register = await this.prisma.register.findUnique({
      where: { id: dto.registerId },
      include: { store: true },
    });
    if (!register) {
      throw new NotFoundException('Comptoir introuvable');
    }

    const existingUser = await this.getActiveSessionForUser(userId);
    if (existingUser) {
      throw new BadRequestException('Vous avez déjà une caisse ouverte.');
    }

    const existingRegister = await this.getOpenSessionForRegister(dto.registerId);
    if (existingRegister) {
      throw new BadRequestException('Ce comptoir est déjà ouvert.');
    }

    const openingInventory = await this.inventoryService.createRegisterInventorySession(
      dto.departmentId,
      InventorySessionKind.OPENING,
      dto.lines,
      userId,
    );

    const session = await this.prisma.registerSession.create({
      data: {
        registerId: dto.registerId,
        departmentId: dto.departmentId,
        openedById: userId,
        openingCashAmount: dto.openingCashAmount ?? null,
        openingInventorySessionId: openingInventory.id,
      },
      include: SESSION_INCLUDE,
    });

    await this.auditService.log({
      userId,
      action: 'REGISTER_SESSION_OPENED',
      entity: 'RegisterSession',
      entityId: String(session.id),
      metadata: { registerId: dto.registerId, departmentId: dto.departmentId },
    });

    return session;
  }

  async closeSession(sessionId: number, dto: CloseRegisterSessionDto, userId: number) {
    const session = await this.prisma.registerSession.findFirst({
      where: { id: sessionId, deletedAt: null },
    });
    if (!session) {
      throw new NotFoundException('Session introuvable');
    }
    if (session.status !== RegisterSessionStatus.OPEN) {
      throw new BadRequestException('Cette caisse est déjà fermée.');
    }
    if (session.openedById !== userId) {
      throw new BadRequestException('Seul le caissier ayant ouvert peut fermer.');
    }

    const closingInventory = await this.inventoryService.createRegisterInventorySession(
      session.departmentId,
      InventorySessionKind.CLOSING,
      dto.lines,
      userId,
    );

    const cashVariance = dto.closingCashCounted - dto.closingCashExpected;

    const closed = await this.prisma.registerSession.update({
      where: { id: sessionId },
      data: {
        status: RegisterSessionStatus.CLOSED,
        closedById: userId,
        closedAt: new Date(),
        closingCashExpected: dto.closingCashExpected,
        closingCashCounted: dto.closingCashCounted,
        cashVariance,
        closingInventorySessionId: closingInventory.id,
      },
      include: SESSION_INCLUDE,
    });

    await this.prisma.cashClosure.create({
      data: {
        registerId: session.registerId,
        expectedAmount: dto.closingCashExpected,
        countedAmount: dto.closingCashCounted,
        variance: cashVariance,
        createdById: userId,
      },
    });

    await this.auditService.log({
      userId,
      action: 'REGISTER_SESSION_CLOSED',
      entity: 'RegisterSession',
      entityId: String(sessionId),
      metadata: { cashVariance },
    });

    return closed;
  }
}
