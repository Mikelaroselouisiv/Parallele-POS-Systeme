import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type AuditInput = {
  userId?: number;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: unknown;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditInput) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId,
          metadata: input.metadata as object | undefined,
        },
      });
    } catch (err) {
      console.error('[AuditService] log failed:', err);
    }
  }
}
