import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ProviderMessage,
  ProviderSendResult,
  SmsNotificationProvider,
  WhatsAppNotificationProvider,
} from './notification-providers';

interface TwilioMessageResponse {
  sid?: unknown;
}

class TwilioClient {
  private readonly accountSid?: string;
  private readonly apiKeySid?: string;
  private readonly apiKeySecret?: string;

  constructor(configService: ConfigService) {
    this.accountSid = configService.get<string>('notification.twilio.accountSid');
    this.apiKeySid = configService.get<string>('notification.twilio.apiKeySid');
    this.apiKeySecret = configService.get<string>('notification.twilio.apiKeySecret');
  }

  assertBaseConfiguration(): void {
    if (!this.accountSid || !this.apiKeySid || !this.apiKeySecret) {
      throw new Error('Twilio account and restricted API-key credentials are required');
    }
  }

  async send(from: string, to: string, body: string): Promise<ProviderSendResult> {
    this.assertBaseConfiguration();
    const form = new URLSearchParams({ From: from, To: to, Body: body });
    const credentials = Buffer.from(`${this.apiKeySid}:${this.apiKeySecret}`).toString('base64');
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.accountSid as string)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${credentials}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: form,
      },
    );
    if (!response.ok) throw new Error(`Twilio send failed with status ${response.status}`);
    const payload = (await response.json()) as TwilioMessageResponse;
    if (typeof payload.sid !== 'string' || !payload.sid) {
      throw new Error('Twilio returned an invalid message response');
    }
    return { providerMessageId: payload.sid };
  }
}

@Injectable()
export class TwilioSmsNotificationProvider implements SmsNotificationProvider {
  private readonly from?: string;
  private readonly client: TwilioClient;

  constructor(configService: ConfigService) {
    this.from = configService.get<string>('notification.twilio.smsFrom');
    this.client = new TwilioClient(configService);
  }

  assertConfigured(): void {
    this.client.assertBaseConfiguration();
    if (!this.from) throw new Error('Twilio SMS sender is required');
  }

  send(message: ProviderMessage, phoneNumber: string): Promise<ProviderSendResult> {
    this.assertConfigured();
    return this.client.send(this.from as string, phoneNumber, `${message.title}\n${message.body}`);
  }

  async sendVerificationCode(phoneNumber: string, code: string, expiresAt: Date): Promise<void> {
    this.assertConfigured();
    await this.client.send(
      this.from as string,
      phoneNumber,
      `FloodLine verification code: ${code}. It expires at ${expiresAt.toISOString()}.`,
    );
  }
}

@Injectable()
export class TwilioWhatsAppNotificationProvider implements WhatsAppNotificationProvider {
  private readonly from?: string;
  private readonly client: TwilioClient;

  constructor(configService: ConfigService) {
    this.from = configService.get<string>('notification.twilio.whatsappFrom');
    this.client = new TwilioClient(configService);
  }

  assertConfigured(): void {
    this.client.assertBaseConfiguration();
    if (!this.from) throw new Error('Twilio WhatsApp sender is required');
  }

  send(message: ProviderMessage, phoneNumber: string): Promise<ProviderSendResult> {
    this.assertConfigured();
    return this.client.send(
      this.from as string,
      `whatsapp:${phoneNumber}`,
      `${message.title}\n${message.body}`,
    );
  }

  async sendVerificationCode(phoneNumber: string, code: string, expiresAt: Date): Promise<void> {
    this.assertConfigured();
    await this.client.send(
      this.from as string,
      `whatsapp:${phoneNumber}`,
      `FloodLine verification code: ${code}. It expires at ${expiresAt.toISOString()}.`,
    );
  }
}
