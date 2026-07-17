import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { RegisterSessionStatus } from '@prisma/client';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CloseRegisterSessionDto,
  OpenRegisterSessionDto,
} from './dto/register-session.dto';
import { RegisterSessionsService } from './register-sessions.service';

@Controller('register-sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RegisterSessionsController {
  constructor(private readonly registerSessionsService: RegisterSessionsService) {}

  @Get('registers')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER', 'CASHIER')
  listRegisters(@Query('companyId') companyIdRaw?: string) {
    const companyId = companyIdRaw ? Number.parseInt(companyIdRaw, 10) : undefined;
    return this.registerSessionsService.listRegisters(
      Number.isFinite(companyId) && companyId! > 0 ? companyId : undefined,
    );
  }

  @Post('registers/ensure-default')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER', 'CASHIER')
  ensureDefaultRegister(@Query('companyId') companyIdRaw: string) {
    const companyId = Number.parseInt(companyIdRaw, 10);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      throw new BadRequestException('companyId est requis.');
    }
    return this.registerSessionsService.ensureDefaultRegister(companyId);
  }

  @Get('active')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER', 'CASHIER')
  getActive(@GetUser() user: { id: number }) {
    return this.registerSessionsService.getActiveSessionForUser(user.id);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER')
  list(
    @Query('companyId') companyIdRaw?: string,
    @Query('registerId') registerIdRaw?: string,
    @Query('status') statusRaw?: string,
    @Query('take') takeRaw?: string,
  ) {
    const companyId = companyIdRaw ? Number.parseInt(companyIdRaw, 10) : undefined;
    const registerId = registerIdRaw ? Number.parseInt(registerIdRaw, 10) : undefined;
    const take = takeRaw ? Number.parseInt(takeRaw, 10) : undefined;
    const status =
      statusRaw === 'OPEN' || statusRaw === 'CLOSED'
        ? (statusRaw as RegisterSessionStatus)
        : undefined;

    return this.registerSessionsService.listSessions({
      companyId: Number.isFinite(companyId) && companyId! > 0 ? companyId : undefined,
      registerId: Number.isFinite(registerId) && registerId! > 0 ? registerId : undefined,
      status,
      take,
    });
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER', 'CASHIER')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.registerSessionsService.getSession(id);
  }

  @Post('open')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER', 'CASHIER')
  open(@Body() dto: OpenRegisterSessionDto, @GetUser() user: { id: number }) {
    return this.registerSessionsService.openSession(dto, user.id);
  }

  @Post(':id/close')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER', 'CASHIER')
  close(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CloseRegisterSessionDto,
    @GetUser() user: { id: number },
  ) {
    return this.registerSessionsService.closeSession(id, dto, user.id);
  }
}
