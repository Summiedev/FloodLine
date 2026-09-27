import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { IncidentType } from '@prisma/client';

export class UpdateAlertPreferencesDto {
  @ApiPropertyOptional({ description: 'Alert distance in meters', example: 3500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  radiusMeters?: number;

  @ApiPropertyOptional({ enum: IncidentType, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(IncidentType, { each: true })
  incidentTypes?: IncidentType[];
}
