import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import { maskPhoneNumber } from './phone-normalization';
import type {
  ProviderMessage,
  ProviderSendResult,
  PushNotificationProvider,
  PushRecipient,
  SmsNotificationProvider,
  WhatsAppNotificationProvider,
} from './notification-providers';

/**
 * Development adapters deliberately do not contact a vendor. They preserve
 * the provider boundary and make delivery observable while local development
 * and tests use no external credentials.
 */
@Injectable()
export class LocalPushNotificationProvider implements PushNotificationProvider {
  constructor(private readonly logger: StructuredLogger) {}

  send(message: ProviderMessage, recipients: PushRecipient[]): Promise<ProviderSendResult> {
    this.logger.log(
      {
        provider: 'local-push',
        mode: 'SIMULATION_ONLY',
        externalDelivery: false,
        notificationId: message.notificationId,
        recipientCount: recipients.length,
      },
      'LocalPushNotificationProvider.send',
    );
    return Promise.resolve({ providerMessageId: `local-push-${randomUUID()}` });
  }
}

@Injectable()
export class LocalSmsNotificationProvider implements SmsNotificationProvider {
  constructor(private readonly logger: StructuredLogger) {}

  send(message: ProviderMessage, phoneNumber: string): Promise<ProviderSendResult> {
    this.logger.log(
      {
        provider: 'local-sms',
        mode: 'SIMULATION_ONLY',
        externalDelivery: false,
        notificationId: message.notificationId,
        phoneNumber: maskPhoneNumber(phoneNumber),
      },
      'LocalSmsNotificationProvider.send',
    );
    return Promise.resolve({ providerMessageId: `local-sms-${randomUUID()}` });
  }

  sendVerificationCode(phoneNumber: string, _code: string, expiresAt: Date): Promise<void> {
    this.logger.log(
      {
        provider: 'local-sms',
        mode: 'SIMULATION_ONLY',
        externalDelivery: false,
        phoneNumber: maskPhoneNumber(phoneNumber),
        expiresAt: expiresAt.toISOString(),
      },
      'LocalSmsNotificationProvider.sendVerificationCode',
    );
    return Promise.resolve();
  }
}

@Injectable()
export class LocalWhatsAppNotificationProvider implements WhatsAppNotificationProvider {
  constructor(private readonly logger: StructuredLogger) {}

  send(message: ProviderMessage, phoneNumber: string): Promise<ProviderSendResult> {
    this.logger.log(
      {
        provider: 'local-whatsapp',
        mode: 'SIMULATION_ONLY',
        externalDelivery: false,
        notificationId: message.notificationId,
        phoneNumber: maskPhoneNumber(phoneNumber),
      },
      'LocalWhatsAppNotificationProvider.send',
    );
    return Promise.resolve({ providerMessageId: `local-whatsapp-${randomUUID()}` });
  }

  sendVerificationCode(phoneNumber: string, _code: string, expiresAt: Date): Promise<void> {
    this.logger.log(
      {
        provider: 'local-whatsapp',
        mode: 'SIMULATION_ONLY',
        externalDelivery: false,
        phoneNumber: maskPhoneNumber(phoneNumber),
        expiresAt: expiresAt.toISOString(),
      },
      'LocalWhatsAppNotificationProvider.sendVerificationCode',
    );
    return Promise.resolve();
  }
}
