import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.store.findMany({
      include: { registers: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
