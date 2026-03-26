import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdatePrinterDto } from './dto/update-printer.dto';

const companyListInclude = {
  _count: {
    select: {
      products: true,
      users: true,
      departments: true,
    },
  },
} as const;

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  private async firstCompanyId() {
    const c = await this.prisma.company.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
    return c?.id ?? null;
  }

  findAll() {
    return this.prisma.company.findMany({
      orderBy: { id: 'asc' },
      include: companyListInclude,
    });
  }

  async findOne(id: number) {
    const c = await this.prisma.company.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true, users: true, departments: true },
        },
      },
    });
    if (!c) {
      throw new NotFoundException('Entreprise introuvable');
    }
    return c;
  }

  async create(dto: CreateCompanyDto) {
    return this.prisma.company.create({
      data: {
        name: dto.name.trim(),
        legalName: dto.legalName?.trim(),
        address: dto.address?.trim() ?? '',
        city: dto.city?.trim(),
        country: dto.country?.trim(),
        phone: dto.phone?.trim(),
        email: dto.email?.trim(),
        headerText: dto.headerText,
        presentationText: dto.presentationText,
        logoUrl: dto.logoUrl?.trim(),
        taxId: dto.taxId?.trim(),
        currency: dto.currency?.trim() ?? 'XOF',
        vatRatePercent: dto.vatRatePercent ?? 0,
      },
      include: companyListInclude,
    });
  }

  async updateById(id: number, dto: UpdateCompanyDto) {
    await this.ensureExists(id);
    return this.prisma.company.update({
      where: { id },
      data: {
        name: dto.name,
        legalName: dto.legalName,
        address: dto.address,
        city: dto.city,
        country: dto.country,
        phone: dto.phone,
        email: dto.email,
        headerText: dto.headerText,
        presentationText: dto.presentationText,
        logoUrl: dto.logoUrl,
        taxId: dto.taxId,
        currency: dto.currency,
        vatRatePercent: dto.vatRatePercent,
      },
      include: {
        _count: {
          select: { products: true, users: true, departments: true },
        },
      },
    });
  }

  async remove(id: number) {
    await this.ensureExists(id);
    const [products, users] = await Promise.all([
      this.prisma.product.count({ where: { companyId: id } }),
      this.prisma.user.count({ where: { companyId: id } }),
    ]);
    if (products > 0) {
      throw new BadRequestException(
        'Impossible de supprimer : des produits sont rattachés à cette entreprise.',
      );
    }
    if (users > 0) {
      throw new BadRequestException(
        'Impossible de supprimer : des utilisateurs sont rattachés à cette entreprise.',
      );
    }
    return this.prisma.company.delete({
      where: { id },
    });
  }

  private async ensureExists(id: number) {
    const c = await this.prisma.company.findUnique({ where: { id }, select: { id: true } });
    if (!c) {
      throw new NotFoundException('Entreprise introuvable');
    }
  }

  getProfile() {
    return this.prisma.company.findFirst({
      orderBy: { id: 'asc' },
    });
  }

  async update(dto: UpdateCompanyDto) {
    const id = await this.firstCompanyId();
    if (!id) {
      throw new NotFoundException('Aucune entreprise en base');
    }
    return this.updateById(id, dto);
  }

  private printerDefaults(departmentId: number) {
    return {
      departmentId,
      paperWidth: 58,
      deviceName: '',
      autoCut: true,
      showLogoOnReceipt: true,
      receiptHeaderText: null as string | null,
      receiptFooterText: null as string | null,
      receiptLogoUrl: null as string | null,
      previewSampleBody: null as string | null,
    };
  }

  /** Sans departmentId : premier profil trouvé, ou défaut pour le 1er département. */
  async getPrinterSettings(departmentId?: number) {
    if (departmentId != null) {
      const dept = await this.prisma.department.findUnique({ where: { id: departmentId } });
      if (!dept) {
        throw new NotFoundException('Département introuvable');
      }
      const row = await this.prisma.departmentPrinterProfile.findUnique({
        where: { departmentId },
      });
      return row ?? { id: 0, ...this.printerDefaults(departmentId) };
    }
    const row = await this.prisma.departmentPrinterProfile.findFirst({ orderBy: { id: 'asc' } });
    if (row) return row;
    const d = await this.prisma.department.findFirst({ orderBy: { id: 'asc' } });
    if (!d) return null;
    return { id: 0, ...this.printerDefaults(d.id) };
  }

  async updatePrinterSettings(dto: UpdatePrinterDto) {
    const dept = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
    if (!dept) {
      throw new NotFoundException('Département introuvable');
    }
    const update: Prisma.DepartmentPrinterProfileUpdateInput = {};
    if (dto.paperWidth !== undefined) update.paperWidth = dto.paperWidth;
    if (dto.deviceName !== undefined) update.deviceName = dto.deviceName.trim();
    if (dto.autoCut !== undefined) update.autoCut = dto.autoCut;
    if (dto.showLogoOnReceipt !== undefined) update.showLogoOnReceipt = dto.showLogoOnReceipt;
    if (dto.receiptHeaderText !== undefined) {
      update.receiptHeaderText = dto.receiptHeaderText.trim() || null;
    }
    if (dto.receiptFooterText !== undefined) {
      update.receiptFooterText = dto.receiptFooterText.trim() || null;
    }
    if (dto.receiptLogoUrl !== undefined) {
      update.receiptLogoUrl = dto.receiptLogoUrl.trim() || null;
    }
    if (dto.previewSampleBody !== undefined) {
      update.previewSampleBody = dto.previewSampleBody.trim() || null;
    }
    return this.prisma.departmentPrinterProfile.upsert({
      where: { departmentId: dto.departmentId },
      create: {
        departmentId: dto.departmentId,
        paperWidth: dto.paperWidth ?? 58,
        deviceName: dto.deviceName?.trim() ?? '',
        autoCut: dto.autoCut ?? true,
        showLogoOnReceipt: dto.showLogoOnReceipt ?? true,
        receiptHeaderText: dto.receiptHeaderText?.trim() || null,
        receiptFooterText: dto.receiptFooterText?.trim() || null,
        receiptLogoUrl: dto.receiptLogoUrl?.trim() || null,
        previewSampleBody: dto.previewSampleBody?.trim() || null,
      },
      update,
    });
  }
}
