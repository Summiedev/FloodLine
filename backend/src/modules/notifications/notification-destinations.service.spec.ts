import { DevicePlatform, PhoneVerificationPurpose } from '@prisma/client';
import { NotificationDestinationsService } from './notification-destinations.service';

const userId = '10000000-0000-4000-8000-000000000001';

function createHarness() {
  const repository = {
    registerDevice: jest.fn().mockResolvedValue({
      id: '20000000-0000-4000-8000-000000000001',
      platform: DevicePlatform.ANDROID,
      appVersion: null,
      lastSeenAt: new Date(),
      createdAt: new Date(),
    }),
    revokeDevice: jest.fn().mockResolvedValue(true),
    findLatestVerification: jest.fn().mockResolvedValue(null),
    findLatestVerificationForUpdate: jest.fn().mockResolvedValue(null),
    ensureMessagingDestination: jest.fn().mockResolvedValue({
      id: '30000000-0000-4000-8000-000000000001',
      phoneNumber: '+2348012345678',
      phoneVerifiedAt: null,
      whatsappStatus: 'PENDING',
      whatsappVerifiedAt: null,
    }),
    createVerification: jest.fn(),
    createVerificationWithinTransaction: jest.fn(),
    findMessagingDestination: jest.fn().mockResolvedValue({
      id: '30000000-0000-4000-8000-000000000001',
      phoneNumber: '+2348012345678',
      phoneVerifiedAt: null,
      whatsappStatus: 'PENDING',
      whatsappVerifiedAt: null,
    }),
  };
  const smsProvider = { sendVerificationCode: jest.fn() };
  const whatsappProvider = { sendVerificationCode: jest.fn() };
  const transaction = { $executeRaw: jest.fn() };
  const prisma = {
    $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(transaction)),
  };
  const config = {
    getOrThrow: jest.fn(
      (key: string) =>
        ({
          'notification.verificationSecret': 'a'.repeat(32),
          'notification.verificationCodeTtlSeconds': 600,
          'notification.verificationResendCooldownSeconds': 60,
          'notification.verificationMaxAttempts': 5,
        })[key],
    ),
  };
  return {
    service: new NotificationDestinationsService(
      prisma as never,
      config as never,
      repository as never,
      smsProvider as never,
      whatsappProvider as never,
    ),
    repository,
    smsProvider,
    whatsappProvider,
    prisma,
  };
}

describe('NotificationDestinationsService', () => {
  it('normalizes phone numbers and never returns the verification code', async () => {
    const harness = createHarness();

    const result = await harness.service.startVerification(
      userId,
      PhoneVerificationPurpose.PHONE,
      '+234 801 234 5678',
    );

    expect(harness.repository.ensureMessagingDestination).toHaveBeenCalledWith(
      userId,
      expect.any(String),
      expect.any(String),
      expect.any(String),
      '+2348012345678',
      expect.any(String),
      expect.any(String),
      PhoneVerificationPurpose.PHONE,
    );
    expect(result).not.toHaveProperty('code');
    expect(result.destination).toBe('+234******678');
    expect(harness.smsProvider.sendVerificationCode).toHaveBeenCalledTimes(1);
  });

  it('rejects rapid repeated OTP initiation', async () => {
    const harness = createHarness();
    harness.repository.findLatestVerificationForUpdate.mockResolvedValue({
      createdAt: new Date(),
    });
    harness.repository.findLatestVerification.mockResolvedValue({
      createdAt: new Date(),
    });

    await expect(
      harness.service.startVerification(userId, PhoneVerificationPurpose.PHONE, '+2348012345678'),
    ).rejects.toBeInstanceOf(Error);
    expect(harness.repository.createVerificationWithinTransaction).not.toHaveBeenCalled();
  });

  it('rejects non-E.164 phone input', async () => {
    const harness = createHarness();

    await expect(
      harness.service.startVerification(userId, PhoneVerificationPurpose.PHONE, '08012345678'),
    ).rejects.toThrow('E.164');
  });
});
