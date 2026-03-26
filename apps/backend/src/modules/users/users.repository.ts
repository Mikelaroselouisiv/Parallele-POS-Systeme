import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const userPublicSelect = {
  id: true,
  email: true,
  role: true,
  fullName: true,
  phone: true,
  isActive: true,
  companyId: true,
  departmentId: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type SafeUser = Omit<User, 'password'>;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  findAll(): Promise<SafeUser[]> {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: userPublicSelect,
    });
  }

  findById(id: number): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: userPublicSelect,
    });
  }

  findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { phone } });
  }

  update(id: number, data: Prisma.UserUpdateInput): Promise<SafeUser> {
    return this.prisma.user.update({
      where: { id },
      data,
      select: userPublicSelect,
    });
  }

  delete(id: number): Promise<SafeUser> {
    return this.prisma.user.delete({
      where: { id },
      select: userPublicSelect,
    });
  }
}
