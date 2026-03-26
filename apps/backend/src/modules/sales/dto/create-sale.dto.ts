import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreateSaleItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productSaleUnitId: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity: number;
}

export class CreatePaymentDto {
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  reference?: string;
}

export class CreateSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentDto)
  payments: CreatePaymentDto[];

  @ValidateIf((o: CreateSaleDto) => Number.isInteger(o.storeId))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  storeId?: number;

  @ValidateIf((o: CreateSaleDto) => Number.isInteger(o.registerId))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  registerId?: number;

  @IsOptional()
  // Nom client (provenant de la fiche POS)
  clientName?: string;
}
