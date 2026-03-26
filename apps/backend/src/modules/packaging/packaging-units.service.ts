import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePackagingUnitDto } from './dto/create-packaging-unit.dto';
import { UpdatePackagingUnitDto } from './dto/update-packaging-unit.dto';

@Injectable()
export class PackagingUnitsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(departmentId: number) {
    if (!Number.isFinite(departmentId) || departmentId < 1) {
      throw new BadRequestException('departmentId est requis et doit être un identifiant valide.');
    }
    const dept = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) {
      throw new NotFoundException('Département introuvable');
    }
    return this.prisma.packagingUnit.findMany({
      where: { departmentId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        department: {
          select: {
            id: true,
            name: true,
            companyId: true,
            company: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async create(dto: CreatePackagingUnitDto) {
    const dept = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
    if (!dept) {
      throw new NotFoundException('Département introuvable');
    }
    const code = dto.code.trim().toUpperCase();
    return this.prisma.packagingUnit.create({
      data: {
        departmentId: dto.departmentId,
        code,
        label: dto.label.trim(),
        sortOrder: dto.sortOrder ?? 0,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            companyId: true,
            company: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async update(id: number, dto: UpdatePackagingUnitDto) {
    const existing = await this.prisma.packagingUnit.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Conditionnement introuvable');
    }

    if (dto.departmentId !== undefined && dto.departmentId !== existing.departmentId) {
      const used = await this.prisma.productSaleUnit.count({ where: { packagingUnitId: id } });
      if (used > 0) {
        throw new BadRequestException(
          'Impossible de changer le département : ce conditionnement est déjà utilisé par des produits.',
        );
      }
      const dept = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
      if (!dept) {
        throw new NotFoundException('Département introuvable');
      }
    }

    const targetDeptId = dto.departmentId ?? existing.departmentId;
    const targetCode =
      dto.code !== undefined ? dto.code.trim().toUpperCase() : existing.code;

    if (targetCode !== existing.code || targetDeptId !== existing.departmentId) {
      const clash = await this.prisma.packagingUnit.findFirst({
        where: {
          departmentId: targetDeptId,
          code: targetCode,
          NOT: { id },
        },
      });
      if (clash) {
        throw new BadRequestException('Ce code existe déjà pour ce département.');
      }
    }

    return this.prisma.packagingUnit.update({
      where: { id },
      data: {
        ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
        ...(dto.code !== undefined ? { code: targetCode } : {}),
        ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            companyId: true,
            company: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async remove(id: number) {
    const existing = await this.prisma.packagingUnit.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Conditionnement introuvable');
    }
    const used = await this.prisma.productSaleUnit.count({ where: { packagingUnitId: id } });
    if (used > 0) {
      throw new BadRequestException(
        'Impossible de supprimer : utilisé par des unités de vente produits.',
      );
    }
    return this.prisma.packagingUnit.delete({ where: { id } });
  }
}
