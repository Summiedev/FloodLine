import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : undefined,
  )
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : undefined,
  )
  displayName!: string;
}
