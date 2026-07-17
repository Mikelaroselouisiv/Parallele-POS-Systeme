import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class DeliveryItemUpdateDto {
  @IsNumber()
  saleItemId!: number;

  @IsNumber()
  @Min(0)
  quantityDelivered!: number;
}

export class UpdateDeliveryDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DeliveryItemUpdateDto)
  items?: DeliveryItemUpdateDto[];

  /** Marque toute la fiche comme livrée. */
  @IsOptional()
  @IsBoolean()
  markDelivered?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}
