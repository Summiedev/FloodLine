import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ConfirmVerificationDto {
  @ApiProperty({ description: 'Six-digit verification code' })
  @IsString()
  @Length(6, 6)
  code!: string;
}
