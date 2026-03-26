import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Min, ValidateIf } from 'class-validator';

export class CreateInventorySessionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId: number;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateInventoryLineDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  countedQty?: number | null;

  @IsOptional()
  @IsString()
  note?: string;
}
