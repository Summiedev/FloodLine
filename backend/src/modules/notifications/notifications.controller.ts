import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AccessTokenGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { NOTIFICATION_RATE_LIMIT, VERIFICATION_RATE_LIMIT } from './notification.constants';
import { NotificationDestinationsService } from './notification-destinations.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { ConfirmVerificationDto } from './dto/confirm-verification.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { StartVerificationDto } from './dto/start-verification.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { PhoneVerificationPurpose } from '@prisma/client';

@Controller({ path: 'notification-preferences', version: '1' })
@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
export class NotificationPreferencesController {
  constructor(private readonly service: NotificationPreferencesService) {}

  @Version('1')
  @Patch()
  @ApiOperation({ summary: 'Update notification-channel preferences' })
  update(@CurrentUser() user: AuthPrincipal, @Body() dto: UpdateNotificationPreferencesDto) {
    return this.service.update(user.userId, dto);
  }

  @Version('1')
  @Get()
  get(@CurrentUser() user: AuthPrincipal) {
    return this.service.get(user.userId);
  }
}

@Controller({ path: 'devices', version: '1' })
@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Throttle(NOTIFICATION_RATE_LIMIT)
export class DeviceRegistrationsController {
  constructor(private readonly service: NotificationDestinationsService) {}

  @Post()
  @Version('1')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register or refresh a push device' })
  register(@CurrentUser() user: AuthPrincipal, @Body() dto: RegisterDeviceDto) {
    return this.service.registerDevice(user.userId, dto);
  }

  @Delete(':id')
  @Version('1')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a push device' })
  async revoke(@CurrentUser() user: AuthPrincipal, @Param('id') id: string): Promise<void> {
    await this.service.revokeDevice(user.userId, id);
  }
}

@Controller({ path: 'phone/verification', version: '1' })
@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Throttle(VERIFICATION_RATE_LIMIT)
export class PhoneVerificationController {
  constructor(private readonly service: NotificationDestinationsService) {}

  @Post('start')
  @Version('1')
  @ApiOperation({ summary: 'Start phone-number verification for SMS notifications' })
  start(@CurrentUser() user: AuthPrincipal, @Body() dto: StartVerificationDto) {
    return this.service.startVerification(
      user.userId,
      PhoneVerificationPurpose.PHONE,
      dto.phoneNumber,
    );
  }

  @Post('confirm')
  @Version('1')
  @ApiOperation({ summary: 'Confirm the current phone verification code' })
  confirm(@CurrentUser() user: AuthPrincipal, @Body() dto: ConfirmVerificationDto) {
    return this.service.confirmVerification(user.userId, PhoneVerificationPurpose.PHONE, dto.code);
  }
}

@Controller({ path: 'whatsapp/connection', version: '1' })
@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Throttle(VERIFICATION_RATE_LIMIT)
export class WhatsAppConnectionController {
  constructor(private readonly service: NotificationDestinationsService) {}

  @Post('start')
  @Version('1')
  @ApiOperation({ summary: 'Start provider-neutral WhatsApp connection verification' })
  start(@CurrentUser() user: AuthPrincipal, @Body() dto: StartVerificationDto) {
    return this.service.startVerification(
      user.userId,
      PhoneVerificationPurpose.WHATSAPP,
      dto.phoneNumber,
    );
  }

  @Post('confirm')
  @Version('1')
  @ApiOperation({ summary: 'Confirm the WhatsApp connection code' })
  confirm(@CurrentUser() user: AuthPrincipal, @Body() dto: ConfirmVerificationDto) {
    return this.service.confirmVerification(
      user.userId,
      PhoneVerificationPurpose.WHATSAPP,
      dto.code,
    );
  }

  @Delete()
  @Version('1')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disconnect WhatsApp notifications' })
  async disconnect(@CurrentUser() user: AuthPrincipal): Promise<void> {
    await this.service.disconnectWhatsApp(user.userId);
  }
}
