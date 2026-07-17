import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, ValidateIf } from 'class-validator';

export enum InventorySessionKindDto {
  OPENING = 'OPENING',
  CLOSING = 'CLOSING',
  AD_HOC = 'AD_HOC',
}

export class CreateInventorySessionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId: number;

  @IsOptional()
  @IsEnum(InventorySessionKindDto)
  kind?: InventorySessionKindDto;

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
