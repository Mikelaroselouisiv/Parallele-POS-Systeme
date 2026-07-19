import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateRegisterDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  companyId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId: number;

  /** Numéro ou libellé affiché (ex. « 1 », « Caisse 2 »). */
  @IsString()
  @MinLength(1)
  code: string;
}

export class RegisterInventoryLineDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  countedQty: number;
}

export class OpenRegisterSessionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  registerId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  openingCashAmount?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RegisterInventoryLineDto)
  lines: RegisterInventoryLineDto[];
}

export class CloseRegisterSessionDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  closingCashExpected: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  closingCashCounted: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RegisterInventoryLineDto)
  lines: RegisterInventoryLineDto[];
}
