import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveCompanyId(explicit?: number) {
    if (explicit) return explicit;
    const c = await this.prisma.company.findFirst({ orderBy: { id: 'asc' } });
    if (!c) {
      throw new BadRequestException('Aucune entreprise configurée');
    }
    return c.id;
  }

  findAll(companyId?: number) {
    return this.prisma.department.findMany({
      where: companyId !== undefined ? { companyId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { company: { select: { id: true, name: true } } },
    });
  }

  async create(dto: CreateDepartmentDto) {
    const companyId = await this.resolveCompanyId(dto.companyId);
    return this.prisma.department.create({
      data: {
        companyId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
      },
      include: { company: { select: { id: true, name: true } } },
    });
  }

  async update(id: number, dto: UpdateDepartmentDto) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Rayon introuvable');
    }
    return this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && {
          description: dto.description?.trim() ?? null,
        }),
      },
      include: { company: { select: { id: true, name: true } } },
    });
  }

  async remove(id: number) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Département introuvable');
    }
    return this.prisma.department.delete({ where: { id } });
  }
}
