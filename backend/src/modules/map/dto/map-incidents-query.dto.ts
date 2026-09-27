import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsEnum, IsISO8601, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { IncidentType } from '@prisma/client';

function splitIncidentTypes(value: unknown): unknown {
  if (Array.isArray(value)) return value.flatMap((item) => String(item).split(','));
  return typeof value === 'string' ? value.split(',') : value;
}

export class MapIncidentsQueryDto {
  @ApiPropertyOptional({ description: 'Northern WGS84 latitude', example: 6.6 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  north!: number;

  @ApiPropertyOptional({ description: 'Southern WGS84 latitude', example: 6.3 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  south!: number;

  @ApiPropertyOptional({
    description: 'Eastern WGS84 longitude; west > east means dateline crossing',
    example: 3.6,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  east!: number;

  @ApiPropertyOptional({ description: 'Western WGS84 longitude', example: 3.2 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  west!: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 24, example: 13 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24)
  zoom?: number;

  @ApiPropertyOptional({ enum: IncidentType, isArray: true })
  @IsOptional()
  @Transform(({ value }) => splitIncidentTypes(value))
  @IsArray()
  @IsEnum(IncidentType, { each: true })
  incidentTypes?: IncidentType[];

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  updatedSince?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 500, default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit = 200;
}
