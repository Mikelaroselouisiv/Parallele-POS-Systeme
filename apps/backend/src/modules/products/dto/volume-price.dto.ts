import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class VolumePriceDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  minQuantity: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice: number;
}
