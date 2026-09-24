import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AccessTokenGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { COMMUNITY_REPORT_RATE_LIMIT } from './flood-reports.constants';
import { CreateFloodReportDto } from './dto/create-flood-report.dto';
import { FloodReportsService } from './flood-reports.service';

@Controller({ path: 'flood-reports', version: '1' })
@ApiTags('flood-reports')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Throttle(COMMUNITY_REPORT_RATE_LIMIT)
export class FloodReportsController {
  constructor(private readonly floodReportsService: FloodReportsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a community flood report' })
  submit(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateFloodReportDto) {
    return this.floodReportsService.submit({
      reporterUserId: user.userId,
      reportType: dto.reportType,
      longitude: dto.longitude,
      latitude: dto.latitude,
      locationName: dto.locationName,
      description: dto.description,
      observedSeverity: dto.observedSeverity,
      ...(dto.waterLevelCategory ? { waterLevelCategory: dto.waterLevelCategory } : {}),
      ...(dto.occurredAt ? { occurredAt: new Date(dto.occurredAt) } : {}),
    });
  }
}
