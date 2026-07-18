import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DeliveriesService } from './deliveries.service';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';

type AuthUser = {
  id?: number;
  role?: string;
  companyId?: number | null;
  departmentId?: number | null;
};

@Controller('deliveries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'CASHIER', 'LIVREUR', 'ACCOUNTANT')
  list(
    @GetUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.deliveriesService.list(user, {
      companyId: DeliveriesController.parsePositiveInt(companyId),
      departmentId: DeliveriesController.parsePositiveInt(departmentId),
      status,
      q,
      skip: DeliveriesController.parseNonNegativeInt(skip),
      take: DeliveriesController.parsePositiveInt(take),
    });
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'CASHIER', 'LIVREUR', 'ACCOUNTANT')
  findOne(@Param('id', ParseIntPipe) id: number, @GetUser() user: AuthUser) {
    return this.deliveriesService.findOne(id, user);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'CASHIER', 'LIVREUR')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDeliveryDto,
    @GetUser() user: AuthUser,
  ) {
    return this.deliveriesService.update(id, dto, user);
  }

  private static parsePositiveInt(raw?: string): number | undefined {
    if (raw == null || raw === '') return undefined;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }

  private static parseNonNegativeInt(raw?: string): number | undefined {
    if (raw == null || raw === '') return undefined;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }
}
