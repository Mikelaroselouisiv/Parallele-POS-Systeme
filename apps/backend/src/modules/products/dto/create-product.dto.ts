import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { VolumePriceDto } from './volume-price.dto';

export class CreateProductSaleUnitDto {
  @Type(() => Number)
  @IsInt()
  packagingUnitId: number;

  /** Réservé compatibilité ; laisser vide (= 1) : stock = même unité que la vente (divisible). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  unitsPerPackage?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salePrice: number;

  @IsOptional()
  @IsString()
  labelOverride?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isDefault?: boolean;

  /** Paliers : à partir de minQuantity (inclus), prix unitaire = unitPrice. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VolumePriceDto)
  volumePrices?: VolumePriceDto[];
}

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  companyId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  departmentId?: number;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isService?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  trackStock?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stockMin?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateProductSaleUnitDto)
  saleUnits: CreateProductSaleUnitDto[];
}
