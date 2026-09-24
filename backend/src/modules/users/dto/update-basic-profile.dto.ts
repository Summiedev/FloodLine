import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateBasicProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Transform(({ value }: TransformFnParams) =>
    typeof value === 'string' ? value.trim() : undefined,
  )
  displayName!: string;
}
