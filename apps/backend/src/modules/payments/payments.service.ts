import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.payment.findMany({
      include: { sale: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
