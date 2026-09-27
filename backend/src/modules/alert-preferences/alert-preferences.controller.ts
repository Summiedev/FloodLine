import { Body, Controller, Get, Patch, UseGuards, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { UpdateAlertPreferencesDto } from './dto/update-alert-preferences.dto';
import { AlertPreferencesService } from './alert-preferences.service';

@Controller({ path: 'alert-preferences', version: '1' })
@ApiTags('alert-preferences')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
export class AlertPreferencesController {
  constructor(private readonly alertPreferencesService: AlertPreferencesService) {}

  @Get()
  @Version('1')
  @ApiOperation({ summary: 'Get the current user alert preferences' })
  get(@CurrentUser() user: AuthPrincipal) {
    return this.alertPreferencesService.getDefault(user.userId);
  }

  @Patch()
  @Version('1')
  @ApiOperation({ summary: 'Update the current user alert preferences' })
  update(@CurrentUser() user: AuthPrincipal, @Body() dto: UpdateAlertPreferencesDto) {
    return this.alertPreferencesService.updateDefault(user.userId, dto);
  }
}
