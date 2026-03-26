import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, Min, ValidateNested } from 'class-validator';

export class RecipeComponentInputDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  componentProductId: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantityPerParentBaseUnit: number;
}

export class UpsertRecipeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeComponentInputDto)
  components: RecipeComponentInputDto[];
}
