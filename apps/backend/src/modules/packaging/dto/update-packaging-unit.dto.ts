import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class UpdatePackagingUnitDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[A-Z0-9_]+$/, {
    message: 'code doit être en majuscules, chiffres et underscores (ex: DEMI_CAISSE)',
  })
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
