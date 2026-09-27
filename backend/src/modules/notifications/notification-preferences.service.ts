import { ConflictException, Injectable } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { ApplicationError } from '../../common/errors/application.error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { NotificationPreferencesRepository } from './notification-preferences.repository';
import type {
  NotificationPreferenceUpdateInput,
  NotificationPreferencesResponse,
} from './notification.types';

@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly repository: NotificationPreferencesRepository) {}

  async get(userId: string): Promise<NotificationPreferencesResponse> {
    this.assertUuid(userId, 'userId');
    await this.repository.ensureDefaults(userId);
    return this.toResponse(userId);
  }

  async update(
    userId: string,
    input: NotificationPreferenceUpdateInput,
  ): Promise<NotificationPreferencesResponse> {
    this.assertUuid(userId, 'userId');
    const availability = await this.repository.getAvailability(userId);
    const requested: Partial<Record<NotificationChannel, boolean>> = {
      ...(input.appPushEnabled !== undefined
        ? { [NotificationChannel.APP_PUSH]: input.appPushEnabled }
        : {}),
      ...(input.smsEnabled !== undefined ? { [NotificationChannel.SMS]: input.smsEnabled } : {}),
      ...(input.whatsappEnabled !== undefined
        ? { [NotificationChannel.WHATSAPP]: input.whatsappEnabled }
        : {}),
    };
    const availabilityByChannel: Record<NotificationChannel, boolean> = {
      APP_PUSH: availability.hasPushDevice,
      SMS: availability.hasVerifiedPhone,
      WHATSAPP: availability.hasVerifiedWhatsApp,
    };
    for (const [channel, enabled] of Object.entries(requested) as Array<
      [NotificationChannel, boolean]
    >) {
      if (enabled && !availabilityByChannel[channel]) {
        throw new ConflictException(this.unavailableMessage(channel));
      }
    }
    if (Object.keys(requested).length > 0) {
      await this.repository.update(userId, requested);
    }
    return this.toResponse(userId);
  }

  private async toResponse(userId: string): Promise<NotificationPreferencesResponse> {
    const [rows, availability] = await Promise.all([
      this.repository.find(userId),
      this.repository.getAvailability(userId),
    ]);
    return { channels: this.repository.toResponse(rows, availability) };
  }

  private unavailableMessage(channel: NotificationChannel): string {
    switch (channel) {
      case NotificationChannel.APP_PUSH:
        return 'Register an active device before enabling app notifications';
      case NotificationChannel.SMS:
        return 'Verify a phone number before enabling SMS notifications';
      case NotificationChannel.WHATSAPP:
        return 'Complete WhatsApp connection verification before enabling WhatsApp notifications';
    }
  }

  private assertUuid(value: string, field: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new ApplicationError(ErrorCodes.ValidationError, `${field} must be a valid UUID`);
    }
  }
}
