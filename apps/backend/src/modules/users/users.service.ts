import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma, Role, User } from '@prisma/client';
import { normalizePhone } from '../../common/utils/phone';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<Omit<User, 'password'>> {
    const phoneNorm = normalizePhone(createUserDto.phone);
    const existingUser = await this.usersRepository.findByPhone(phoneNorm);
    if (existingUser) {
      throw new ConflictException('Ce numéro de téléphone est déjà utilisé');
    }

    const role = createUserDto.role ?? Role.CASHIER;
    if (role !== Role.ADMIN && createUserDto.departmentId == null) {
      throw new BadRequestException(
        'Un département est requis pour ce rôle (sauf pour le profil administrateur global).',
      );
    }

    let companyConnect: { connect: { id: number } } | undefined;
    let departmentConnect: { connect: { id: number } } | undefined;
    if (createUserDto.departmentId != null) {
      const dept = await this.prisma.department.findUnique({
        where: { id: createUserDto.departmentId },
      });
      if (!dept) {
        throw new BadRequestException('Département introuvable');
      }
      companyConnect = { connect: { id: dept.companyId } };
      departmentConnect = { connect: { id: dept.id } };
    }

    const password = await bcrypt.hash(createUserDto.password, 10);
    const user = await this.usersRepository.create({
      phone: phoneNorm,
      password,
      role,
      fullName: createUserDto.fullName,
      isActive: createUserDto.isActive ?? true,
      ...(createUserDto.email?.trim() ? { email: createUserDto.email.trim() } : {}),
      ...(companyConnect ? { company: companyConnect } : {}),
      ...(departmentConnect ? { department: departmentConnect } : {}),
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...safeUser } = user;
    return safeUser;
  }

  findAll() {
    return this.usersRepository.findAll();
  }

  async findOne(id: number) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  findByPhone(phone: string) {
    return this.usersRepository.findByPhone(normalizePhone(phone));
  }

  async update(id: number, dto: UpdateUserDto) {
    const existing = await this.usersRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    if (dto.phone != null) {
      const next = normalizePhone(dto.phone);
      if (next !== existing.phone) {
        const taken = await this.usersRepository.findByPhone(next);
        if (taken) {
          throw new ConflictException('Ce numéro de téléphone est déjà utilisé');
        }
      }
    }

    if (dto.role != null && dto.role !== Role.ADMIN && existing.role === Role.ADMIN) {
      const otherAdmins = await this.prisma.user.count({
        where: { role: Role.ADMIN, id: { not: id } },
      });
      if (otherAdmins === 0) {
        throw new BadRequestException('Impossible : dernier administrateur du système');
      }
    }

    const nextRole = dto.role ?? existing.role;
    const nextDeptId =
      dto.departmentId !== undefined ? dto.departmentId : existing.departmentId;
    if (nextRole !== Role.ADMIN && nextDeptId == null) {
      throw new BadRequestException(
        'Un département est requis pour ce rôle (sauf pour le profil administrateur global).',
      );
    }

    let passwordHash: string | undefined;
    if (dto.password) {
      passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const phoneUpdate =
      dto.phone != null ? normalizePhone(dto.phone) : undefined;

    const data: Prisma.UserUpdateInput = {
      ...(phoneUpdate !== undefined ? { phone: phoneUpdate } : {}),
      ...(passwordHash && { password: passwordHash }),
      ...(dto.role !== undefined ? { role: dto.role } : {}),
      ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      company:
        dto.companyId === null
          ? { disconnect: true }
          : dto.companyId !== undefined
            ? { connect: { id: dto.companyId } }
            : undefined,
      department:
        dto.departmentId === null
          ? { disconnect: true }
          : dto.departmentId !== undefined
            ? { connect: { id: dto.departmentId } }
            : undefined,
    };
    if (dto.email !== undefined) {
      data.email = dto.email.trim() === '' ? null : dto.email.trim();
    }

    return this.usersRepository.update(id, data);
  }

  async remove(id: number, actingUserId: number) {
    if (id === actingUserId) {
      throw new BadRequestException('Vous ne pouvez pas supprimer votre propre compte');
    }
    const existing = await this.usersRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    if (existing.role === Role.ADMIN) {
      const otherAdmins = await this.prisma.user.count({
        where: { role: Role.ADMIN, id: { not: id } },
      });
      if (otherAdmins === 0) {
        throw new BadRequestException('Impossible : dernier administrateur du système');
      }
    }
    return this.usersRepository.delete(id);
  }
}
