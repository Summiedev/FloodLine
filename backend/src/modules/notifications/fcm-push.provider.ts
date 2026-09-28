import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'node:crypto';
import type {
  ProviderMessage,
  ProviderSendResult,
  PushNotificationProvider,
  PushRecipient,
} from './notification-providers';

interface AccessTokenResponse {
  access_token?: unknown;
  expires_in?: unknown;
}

@Injectable()
export class FcmPushNotificationProvider implements PushNotificationProvider {
  private readonly projectId?: string;
  private readonly clientEmail?: string;
  private readonly privateKey?: string;
  private accessToken: { value: string; expiresAtMs: number } | null = null;

  constructor(configService: ConfigService) {
    this.projectId = configService.get<string>('notification.firebase.projectId');
    this.clientEmail = configService.get<string>('notification.firebase.clientEmail');
    this.privateKey = configService.get<string>('notification.firebase.privateKey');
  }

  assertConfigured(): void {
    if (!this.projectId || !this.clientEmail || !this.privateKey) {
      throw new Error('FCM requires Firebase service-account configuration');
    }
  }

  async send(message: ProviderMessage, recipients: PushRecipient[]): Promise<ProviderSendResult> {
    this.assertConfigured();
    if (recipients.length === 0) throw new Error('FCM requires at least one device token');
    const projectId = this.projectId;
    if (!projectId) throw new Error('FCM project ID is missing');
    const accessToken = await this.getAccessToken();
    const responses = await Promise.all(
      recipients.map(async (recipient) => {
        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
          {
            method: 'POST',
            headers: {
              authorization: `Bearer ${accessToken}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              message: {
                token: recipient.token,
                notification: { title: message.title, body: message.body },
                data: { notificationId: message.notificationId },
              },
            }),
          },
        );
        if (!response.ok) throw new Error(`FCM send failed with status ${response.status}`);
        const payload = (await response.json()) as { name?: unknown };
        if (typeof payload.name !== 'string' || !payload.name) {
          throw new Error('FCM returned an invalid message response');
        }
        return payload.name;
      }),
    );
    return { providerMessageId: responses[0] };
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAtMs > Date.now() + 60_000) {
      return this.accessToken.value;
    }
    const nowSeconds = Math.floor(Date.now() / 1_000);
    const assertion = this.createAssertion(nowSeconds);
    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    });
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) throw new Error(`FCM authentication failed with status ${response.status}`);
    const payload = (await response.json()) as AccessTokenResponse;
    if (
      typeof payload.access_token !== 'string' ||
      !payload.access_token ||
      !Number.isFinite(payload.expires_in)
    ) {
      throw new Error('FCM authentication returned an invalid access token');
    }
    this.accessToken = {
      value: payload.access_token,
      expiresAtMs: Date.now() + Number(payload.expires_in) * 1_000,
    };
    return this.accessToken.value;
  }

  private createAssertion(nowSeconds: number): string {
    const encode = (value: Record<string, unknown>) =>
      Buffer.from(JSON.stringify(value)).toString('base64url');
    const header = encode({ alg: 'RS256', typ: 'JWT' });
    const claims = encode({
      iss: this.clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: nowSeconds,
      exp: nowSeconds + 3_600,
    });
    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${claims}`);
    signer.end();
    return `${header}.${claims}.${signer.sign(this.privateKey as string, 'base64url')}`;
  }
}
