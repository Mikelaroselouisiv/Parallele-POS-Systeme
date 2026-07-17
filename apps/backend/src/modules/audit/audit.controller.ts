import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from './audit.service';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'ACCOUNTANT')
  list(
    @Query('skip') skipRaw?: string,
    @Query('take') takeRaw?: string,
    @Query('entity') entity?: string,
    @Query('userId') userIdRaw?: string,
  ) {
    const skip = skipRaw ? Number.parseInt(skipRaw, 10) : 0;
    const take = takeRaw ? Number.parseInt(takeRaw, 10) : 50;
    const userId = userIdRaw ? Number.parseInt(userIdRaw, 10) : undefined;
    return this.auditService.list({
      skip: Number.isFinite(skip) ? skip : 0,
      take: Number.isFinite(take) ? take : 50,
      entity,
      userId: userId != null && Number.isFinite(userId) ? userId : undefined,
    });
  }
}
