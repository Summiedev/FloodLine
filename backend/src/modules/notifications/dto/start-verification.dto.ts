import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class StartVerificationDto {
  @ApiProperty({ description: 'Phone number in E.164 format, e.g. +2348012345678' })
  @IsString()
  @Length(8, 20)
  phoneNumber!: string;
}
