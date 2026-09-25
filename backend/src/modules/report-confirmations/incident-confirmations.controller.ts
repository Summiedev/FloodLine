import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AccessTokenGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { IncidentConfirmationsService } from './incident-confirmations.service';

const INCIDENT_CONFIRMATION_RATE_LIMIT = { default: { limit: 30, ttl: 60_000 } };

@Controller({ path: 'incidents', version: '1' })
@ApiTags('incident-confirmations')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Throttle(INCIDENT_CONFIRMATION_RATE_LIMIT)
export class IncidentConfirmationsController {
  constructor(private readonly confirmationsService: IncidentConfirmationsService) {}

  @Post(':incidentId/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm that an active incident is still present' })
  confirm(
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.confirmationsService.confirm(incidentId, user.userId);
  }
}
