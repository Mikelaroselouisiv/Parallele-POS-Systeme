import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { normalizePhone } from '../../common/utils/phone';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async register(registerDto: RegisterDto) {
    const user = await this.usersService.create({ ...registerDto, role: Role.CASHIER });
    const tokens = await this.createSessionTokens(
      user.id,
      this.phoneForJwt(user.phone),
      user.role,
    );
    await this.auditService.log({
      userId: user.id,
      action: 'REGISTER',
      entity: 'USER',
      entityId: String(user.id),
    });
    return { user, ...tokens };
  }

  async login(loginDto: LoginDto) {
    const phoneNorm = normalizePhone(loginDto.phone);
    const user = await this.usersService.findByPhone(phoneNorm);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isActive === false) {
      throw new UnauthorizedException('Compte désactivé');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.createSessionTokens(
      user.id,
      this.phoneForJwt(user.phone),
      user.role,
    );
    await this.auditService.log({
      userId: user.id,
      action: 'LOGIN',
      entity: 'SESSION',
      entityId: String(user.id),
    });
    return {
      ...tokens,
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        createdAt: user.createdAt,
      },
    };
  }

  async me(userId: number) {
    return this.usersService.findOne(userId);
  }

  async refresh(dto: RefreshTokenDto) {
    const session = await this.prisma.session.findFirst({
      where: {
        refreshToken: dto.refreshToken,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.createSessionTokens(
      session.user.id,
      this.phoneForJwt(session.user.phone),
      session.user.role,
    );
    await this.auditService.log({
      userId: session.user.id,
      action: 'TOKEN_REFRESH',
      entity: 'SESSION',
      entityId: String(session.id),
    });
    return tokens;
  }

  async logout(dto: RefreshTokenDto) {
    await this.prisma.session.updateMany({
      where: { refreshToken: dto.refreshToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** JWT aligné sur le téléphone stocké (Prisma peut typer `phone` nullable tant que le client n’est pas régénéré). */
  private phoneForJwt(phone: string | null | undefined): string {
    const v = phone?.trim();
    if (!v) {
      throw new UnauthorizedException('Compte sans numéro de téléphone');
    }
    return v;
  }

  private async createSessionTokens(userId: number, phone: string, role: string) {
    const accessToken = await this.signToken(userId, phone, role);
    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, phone, role, type: 'refresh' },
      { expiresIn: '7d' },
    );
    await this.prisma.session.create({
      data: {
        userId,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    return { accessToken, refreshToken };
  }

  private signToken(userId: number, phone: string, role: string) {
    return this.jwtService.signAsync({ sub: userId, phone, role });
  }
}
