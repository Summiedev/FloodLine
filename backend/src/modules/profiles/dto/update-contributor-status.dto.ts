import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ContributorStatus } from '@prisma/client';

export class UpdateContributorStatusDto {
  @IsEnum(ContributorStatus)
  status!: ContributorStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
