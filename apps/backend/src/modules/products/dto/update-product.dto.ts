import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { VolumePriceDto } from './volume-price.dto';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  companyId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  departmentId?: number | null;

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

  /** Met à jour le prix de base de l’unité de vente par défaut. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salePrice?: number;

  /** Remplace les paliers de l’unité par défaut (tableau vide = supprimer tous les paliers). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VolumePriceDto)
  volumePrices?: VolumePriceDto[];

  /** Conditionnement de l’unité de vente par défaut (= unité de stock). Doit appartenir au département du produit. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  packagingUnitId?: number;

  /** Libellé affiché à la caisse à la place du libellé du conditionnement (optionnel). */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  labelOverride?: string | null;
}
