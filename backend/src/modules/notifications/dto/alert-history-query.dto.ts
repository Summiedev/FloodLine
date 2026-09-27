import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { IncidentSeverity, NotificationType } from '@prisma/client';
import { PageQueryDto } from '../../../common/pagination/pagination.dto';

function parseBoolean(value: unknown): unknown {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}

export class AlertHistoryQueryDto extends PageQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseBoolean(value))
  @IsBoolean()
  unread?: boolean;

  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @IsOptional()
  @IsEnum(NotificationType)
  category?: NotificationType;
}
