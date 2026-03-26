import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER')
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER', 'CASHIER')
  findAll(@Query('departmentId') departmentIdRaw?: string) {
    if (departmentIdRaw === undefined || departmentIdRaw === '') {
      return this.productsService.findAll();
    }
    const id = parseInt(departmentIdRaw, 10);
    if (Number.isNaN(id)) {
      throw new BadRequestException('departmentId invalide');
    }
    return this.productsService.findAll(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER', 'STOCK_MANAGER')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.remove(id);
  }
}
