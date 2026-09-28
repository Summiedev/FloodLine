import {
  TwilioSmsNotificationProvider,
  TwilioWhatsAppNotificationProvider,
} from './twilio-notification.providers';

const originalFetch = global.fetch;
const config = {
  get: jest.fn((key: string) => {
    const values: Record<string, string> = {
      'notification.twilio.accountSid': 'AC00000000000000000000000000000000',
      'notification.twilio.apiKeySid': 'SK00000000000000000000000000000000',
      'notification.twilio.apiKeySecret': 'a-very-long-test-secret',
      'notification.twilio.smsFrom': '+14155550100',
      'notification.twilio.whatsappFrom': 'whatsapp:+14155238886',
    };
    return values[key];
  }),
};

describe('Twilio notification providers', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('keeps provider credentials server-side and formats WhatsApp destinations', async () => {
    const sentRequests: RequestInit[] = [];
    global.fetch = ((_input, init) => {
      sentRequests.push(init ?? {});
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ sid: 'SM123' }),
      });
    }) as typeof fetch;
    const sms = new TwilioSmsNotificationProvider(config as never);
    const whatsapp = new TwilioWhatsAppNotificationProvider(config as never);

    await expect(
      sms.send({ notificationId: 'n1', title: 'FloodLine', body: 'Alert' }, '+2348012345678'),
    ).resolves.toEqual({ providerMessageId: 'SM123' });
    await whatsapp.send(
      { notificationId: 'n1', title: 'FloodLine', body: 'Alert' },
      '+2348012345678',
    );

    const smsBody = formBody(sentRequests[0]?.body);
    const whatsappBody = formBody(sentRequests[1]?.body);
    expect(smsBody).toContain('From=%2B14155550100');
    expect(whatsappBody).toContain('To=whatsapp%3A%2B2348012345678');
    expect(String((sentRequests[0]?.headers as Record<string, string>)?.authorization)).toMatch(
      /^Basic /,
    );
  });
});

function formBody(body: BodyInit | null | undefined): string {
  if (typeof body === 'string') return body;
  if (body instanceof URLSearchParams) return body.toString();
  return '';
}
