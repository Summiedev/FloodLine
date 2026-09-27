import type { NotificationChannel } from '@prisma/client';

export interface ProviderMessage {
  notificationId: string;
  title: string;
  body: string;
  templateParameters?: Record<string, unknown> | null;
}

export interface PushRecipient {
  registrationId: string;
  token: string;
  platform: string;
}

export interface ProviderSendResult {
  providerMessageId: string;
}

export interface PushNotificationProvider {
  send(message: ProviderMessage, recipients: PushRecipient[]): Promise<ProviderSendResult>;
}

export interface SmsNotificationProvider {
  send(message: ProviderMessage, phoneNumber: string): Promise<ProviderSendResult>;
  sendVerificationCode(phoneNumber: string, code: string, expiresAt: Date): Promise<void>;
}

export interface WhatsAppNotificationProvider {
  send(message: ProviderMessage, phoneNumber: string): Promise<ProviderSendResult>;
  sendVerificationCode(phoneNumber: string, code: string, expiresAt: Date): Promise<void>;
}

export const PUSH_NOTIFICATION_PROVIDER = Symbol('PUSH_NOTIFICATION_PROVIDER');
export const SMS_NOTIFICATION_PROVIDER = Symbol('SMS_NOTIFICATION_PROVIDER');
export const WHATSAPP_NOTIFICATION_PROVIDER = Symbol('WHATSAPP_NOTIFICATION_PROVIDER');

export function isMessageChannel(channel: NotificationChannel): boolean {
  return channel === 'SMS' || channel === 'WHATSAPP';
}
