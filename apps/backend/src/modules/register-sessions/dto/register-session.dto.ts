import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

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
