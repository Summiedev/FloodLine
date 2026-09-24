import { Type } from 'class-transformer';
import { IsEnum, IsISO8601, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { IncidentSeverity, IncidentStatus, IncidentType } from '@prisma/client';
import { PageQueryDto } from '../../../common/pagination/pagination.dto';

export class IncidentQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(IncidentType)
  incidentType?: IncidentType;

  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @IsOptional()
  @IsISO8601()
  updatedSince?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  west?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  south?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  east?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  north?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100_000)
  radiusMeters?: number;
}
