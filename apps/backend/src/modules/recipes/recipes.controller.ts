import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UpsertRecipeDto } from './dto/recipe.dto';
import { RecipesService } from './recipes.service';

@Controller('recipes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get('by-product/:productId')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER', 'CASHIER')
  getByProduct(@Param('productId', ParseIntPipe) productId: number) {
    return this.recipesService.getByParentProduct(productId);
  }

  @Put(':productId')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER')
  upsert(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: UpsertRecipeDto,
  ) {
    return this.recipesService.upsert(productId, dto);
  }

  @Delete(':productId')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER')
  remove(@Param('productId', ParseIntPipe) productId: number) {
    return this.recipesService.remove(productId);
  }
}
