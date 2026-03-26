import { IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(6)
  @Matches(/^[0-9+().\s-]+$/, {
    message: 'Numéro de téléphone invalide',
  })
  phone: string;

  @IsString()
  @MinLength(6)
  password: string;
}
