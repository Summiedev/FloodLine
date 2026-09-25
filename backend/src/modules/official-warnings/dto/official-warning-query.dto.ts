import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { OfficialWarningStatus } from '@prisma/client';
import { PageQueryDto } from '../../../common/pagination/pagination.dto';

function parseBoolean(value: unknown): unknown {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}

export class OfficialWarningQueryDto extends PageQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseBoolean(value))
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsEnum(OfficialWarningStatus)
  status?: OfficialWarningStatus;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100_000)
  radiusMeters?: number;

  @IsOptional()
  @IsISO8601()
  issuedFrom?: string;

  @IsOptional()
  @IsISO8601()
  issuedTo?: string;

  @IsOptional()
  @IsISO8601()
  effectiveFrom?: string;

  @IsOptional()
  @IsISO8601()
  effectiveTo?: string;

  @IsOptional()
  @IsISO8601()
  updatedSince?: string;
}
