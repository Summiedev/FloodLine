import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AlertEvaluationRepository } from './alert-evaluation.repository';
import { AlertEvaluationService, NotificationDeliveryService } from './alert-evaluation.service';
import {
  DeviceRegistrationsController,
  NotificationPreferencesController,
  PhoneVerificationController,
  WhatsAppConnectionController,
} from './notifications.controller';
import { NotificationDestinationsRepository } from './notification-destinations.repository';
import { NotificationDestinationsService } from './notification-destinations.service';
import { NotificationDeliveryRepository } from './notification-delivery.repository';
import { NotificationPreferencesRepository } from './notification-preferences.repository';
import { NotificationPreferencesService } from './notification-preferences.service';
import { AlertHistoryController } from './alert-history.controller';
import { AlertHistoryRepository } from './alert-history.repository';
import { AlertHistoryService } from './alert-history.service';
import {
  LocalPushNotificationProvider,
  LocalSmsNotificationProvider,
  LocalWhatsAppNotificationProvider,
} from './local-notification-providers';
import {
  PUSH_NOTIFICATION_PROVIDER,
  SMS_NOTIFICATION_PROVIDER,
  WHATSAPP_NOTIFICATION_PROVIDER,
} from './notification-providers';
import { DeviceTokenCipher } from './device-token-cipher';

@Module({
  imports: [AuthModule],
  controllers: [
    NotificationPreferencesController,
    DeviceRegistrationsController,
    PhoneVerificationController,
    WhatsAppConnectionController,
    AlertHistoryController,
  ],
  providers: [
    NotificationPreferencesRepository,
    NotificationPreferencesService,
    DeviceTokenCipher,
    NotificationDestinationsRepository,
    NotificationDestinationsService,
    AlertEvaluationRepository,
    NotificationDeliveryRepository,
    AlertEvaluationService,
    NotificationDeliveryService,
    AlertHistoryRepository,
    AlertHistoryService,
    LocalPushNotificationProvider,
    LocalSmsNotificationProvider,
    LocalWhatsAppNotificationProvider,
    { provide: PUSH_NOTIFICATION_PROVIDER, useExisting: LocalPushNotificationProvider },
    { provide: SMS_NOTIFICATION_PROVIDER, useExisting: LocalSmsNotificationProvider },
    { provide: WHATSAPP_NOTIFICATION_PROVIDER, useExisting: LocalWhatsAppNotificationProvider },
  ],
  exports: [
    NotificationPreferencesService,
    NotificationDestinationsService,
    AlertEvaluationService,
    NotificationDeliveryService,
  ],
})
export class NotificationsModule {}
