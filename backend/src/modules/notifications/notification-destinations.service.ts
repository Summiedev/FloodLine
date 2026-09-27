import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DevicePlatform, PhoneVerificationPurpose, Prisma } from '@prisma/client';
import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { ApplicationError } from '../../common/errors/application.error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { PrismaService } from '../../database/prisma.service';
import { normalizeE164, maskPhoneNumber } from './phone-normalization';
import {
  SMS_NOTIFICATION_PROVIDER,
  WHATSAPP_NOTIFICATION_PROVIDER,
} from './notification-providers';
import type {
  SmsNotificationProvider,
  WhatsAppNotificationProvider,
} from './notification-providers';
import { NotificationDestinationsRepository } from './notification-destinations.repository';
import type {
  DeviceRegistrationInput,
  DeviceRegistrationResponse,
  MessagingDestinationState,
  VerificationStartResponse,
} from './notification.types';
@Injectable()
export class NotificationDestinationsService {
  private readonly verificationSecret: string;
  private readonly codeTtlSeconds: number;
  private readonly resendCooldownSeconds: number;
  private readonly maxAttempts: number;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
    private readonly repository: NotificationDestinationsRepository,
    @Inject(SMS_NOTIFICATION_PROVIDER)
    private readonly smsProvider: SmsNotificationProvider,
    @Inject(WHATSAPP_NOTIFICATION_PROVIDER)
    private readonly whatsappProvider: WhatsAppNotificationProvider,
  ) {
    this.verificationSecret = configService.getOrThrow<string>('notification.verificationSecret');
    this.codeTtlSeconds = configService.getOrThrow<number>(
      'notification.verificationCodeTtlSeconds',
    );
    this.resendCooldownSeconds = configService.getOrThrow<number>(
      'notification.verificationResendCooldownSeconds',
    );
    this.maxAttempts = configService.getOrThrow<number>('notification.verificationMaxAttempts');
  }

  async registerDevice(
    userId: string,
    input: DeviceRegistrationInput,
  ): Promise<DeviceRegistrationResponse> {
    this.assertUuid(userId, 'userId');
    if (!input.token.trim() || input.token.length > 2_048) {
      throw new ApplicationError(ErrorCodes.ValidationError, 'token is invalid');
    }
    if (!Object.values(DevicePlatform).includes(input.platform)) {
      throw new ApplicationError(ErrorCodes.ValidationError, 'platform is invalid');
    }
    const token = input.token.trim();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    return this.repository.registerDevice(
      userId,
      randomUUID(),
      randomUUID(),
      token,
      tokenHash,
      input.platform,
      input.appVersion?.trim(),
    );
  }

  async revokeDevice(userId: string, deviceId: string): Promise<void> {
    this.assertUuid(userId, 'userId');
    this.assertUuid(deviceId, 'deviceId');
    if (!(await this.repository.revokeDevice(userId, deviceId))) {
      throw new NotFoundException('Device registration not found');
    }
  }

  async startVerification(
    userId: string,
    purpose: PhoneVerificationPurpose,
    phoneNumber: string,
  ): Promise<VerificationStartResponse> {
    this.assertUuid(userId, 'userId');
    const normalizedPhone = normalizeE164(phoneNumber);
    const latest = await this.repository.findLatestVerification(userId, purpose);
    if (latest && latest.createdAt.getTime() >= Date.now() - this.resendCooldownSeconds * 1_000) {
      throw new ApplicationError(
        ErrorCodes.RateLimited,
        'Please wait before requesting another verification code',
        429,
      );
    }
    const destination = await this.repository.ensureMessagingDestination(
      userId,
      randomUUID(),
      randomUUID(),
      randomUUID(),
      normalizedPhone,
      this.hashDestination(normalizedPhone, 'SMS'),
      this.hashDestination(normalizedPhone, 'WHATSAPP'),
      purpose,
    );
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + this.codeTtlSeconds * 1_000);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`verification:${userId}:${purpose}`}))`,
      );
      const latest = await this.repository.findLatestVerificationForUpdate(
        transaction,
        userId,
        purpose,
      );
      if (latest && latest.createdAt.getTime() >= Date.now() - this.resendCooldownSeconds * 1_000) {
        throw new ApplicationError(
          ErrorCodes.RateLimited,
          'Please wait before requesting another verification code',
          429,
        );
      }
      await this.repository.createVerificationWithinTransaction(
        transaction,
        randomUUID(),
        userId,
        destination.id,
        purpose,
        this.hashCode(code),
        expiresAt,
        this.maxAttempts,
      );
    });
    if (purpose === PhoneVerificationPurpose.PHONE) {
      await this.smsProvider.sendVerificationCode(normalizedPhone, code, expiresAt);
    } else {
      await this.whatsappProvider.sendVerificationCode(normalizedPhone, code, expiresAt);
    }
    return { expiresAt, destination: maskPhoneNumber(normalizedPhone), purpose };
  }

  async confirmVerification(
    userId: string,
    purpose: PhoneVerificationPurpose,
    code: string,
  ): Promise<{ verified: true; destination: string; purpose: PhoneVerificationPurpose }> {
    this.assertUuid(userId, 'userId');
    if (!/^\d{6}$/.test(code)) {
      throw new ApplicationError(ErrorCodes.ValidationError, 'code must be a six-digit code');
    }
    const destination = await this.repository.findMessagingDestination(userId);
    if (!destination) throw new ConflictException('No verification was started');
    await this.prisma.$transaction(async (transaction) => {
      const verification = await this.repository.findLatestVerificationForUpdate(
        transaction,
        userId,
        purpose,
      );
      if (!verification || verification.consumedAt) {
        throw new ConflictException('Verification code is invalid or expired');
      }
      if (verification.expiresAt <= new Date()) {
        throw new ConflictException('Verification code is invalid or expired');
      }
      if (verification.attemptCount >= verification.maxAttempts) {
        throw new ConflictException('Verification attempts exceeded');
      }
      const expected = Buffer.from(verification.codeHash, 'hex');
      const actual = Buffer.from(this.hashCode(code), 'hex');
      const valid = expected.length === actual.length && timingSafeEqual(expected, actual);
      if (!valid) {
        const attempts = await this.repository.incrementVerificationAttempt(
          transaction,
          verification.id,
        );
        if (attempts >= verification.maxAttempts) {
          throw new ConflictException('Verification attempts exceeded');
        }
        throw new ConflictException('Verification code is invalid or expired');
      }
      await this.repository.completeVerification(
        transaction,
        verification.id,
        verification.destinationId,
        purpose,
      );
    });
    return {
      verified: true,
      destination: maskPhoneNumber(destination.phoneNumber),
      purpose,
    };
  }

  async disconnectWhatsApp(userId: string): Promise<void> {
    this.assertUuid(userId, 'userId');
    const changed = await this.repository.disconnectWhatsApp(userId);
    if (!changed) throw new NotFoundException('WhatsApp connection not found');
  }

  getMessagingState(state: MessagingDestinationState | null): MessagingDestinationState | null {
    if (!state) return null;
    return { ...state, phoneNumber: maskPhoneNumber(state.phoneNumber) };
  }

  private hashCode(code: string): string {
    return createHmac('sha256', this.verificationSecret).update(code).digest('hex');
  }

  private hashDestination(destination: string, channel: string): string {
    return createHmac('sha256', this.verificationSecret)
      .update(`${channel}:${destination}`)
      .digest('hex');
  }

  private assertUuid(value: string, field: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new ApplicationError(ErrorCodes.ValidationError, `${field} must be a valid UUID`);
    }
  }
}
