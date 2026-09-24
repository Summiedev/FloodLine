import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { FloodReportWaterLevelCategory, IncidentSeverity, IncidentType } from '@prisma/client';

export class CreateFloodReportDto {
  @ApiProperty({ enum: IncidentType })
  @IsEnum(IncidentType)
  reportType!: IncidentType;

  @ApiProperty({ description: 'WGS84 longitude, from -180 to 180' })
  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @ApiProperty({ description: 'WGS84 latitude, from -90 to 90' })
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @Length(1, 200)
  locationName!: string;

  @ApiProperty({ maxLength: 5_000 })
  @IsString()
  @Length(1, 5_000)
  description!: string;

  @ApiProperty({ enum: IncidentSeverity })
  @IsEnum(IncidentSeverity)
  observedSeverity!: IncidentSeverity;

  @ApiPropertyOptional({ enum: FloodReportWaterLevelCategory })
  @IsOptional()
  @IsEnum(FloodReportWaterLevelCategory)
  waterLevelCategory?: FloodReportWaterLevelCategory;

  @ApiPropertyOptional({ description: 'When the flooding condition was observed' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
