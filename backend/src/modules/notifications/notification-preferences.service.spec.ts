import { ConflictException } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { NotificationPreferencesService } from './notification-preferences.service';

const userId = '10000000-0000-4000-8000-000000000001';

function createService(
  availability = { hasPushDevice: true, hasVerifiedPhone: true, hasVerifiedWhatsApp: true },
) {
  const repository = {
    ensureDefaults: jest.fn(),
    getAvailability: jest.fn().mockResolvedValue(availability),
    find: jest.fn().mockResolvedValue([
      { channel: NotificationChannel.APP_PUSH, enabled: false },
      { channel: NotificationChannel.SMS, enabled: false },
      { channel: NotificationChannel.WHATSAPP, enabled: false },
    ]),
    update: jest.fn(),
    toResponse: jest.fn((_rows, state: { hasPushDevice: boolean }) => [
      { channel: NotificationChannel.APP_PUSH, enabled: false, available: state.hasPushDevice },
    ]),
  };
  return { service: new NotificationPreferencesService(repository as never), repository };
}

describe('NotificationPreferencesService', () => {
  it('does not allow push without an active device', async () => {
    const { service, repository } = createService({
      hasPushDevice: false,
      hasVerifiedPhone: true,
      hasVerifiedWhatsApp: true,
    });

    await expect(service.update(userId, { appPushEnabled: true })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('does not allow SMS or WhatsApp without verified destinations', async () => {
    const { service } = createService({
      hasPushDevice: true,
      hasVerifiedPhone: false,
      hasVerifiedWhatsApp: false,
    });

    await expect(service.update(userId, { smsEnabled: true })).rejects.toThrow(
      'Verify a phone number',
    );
    await expect(service.update(userId, { whatsappEnabled: true })).rejects.toThrow(
      'Complete WhatsApp connection verification',
    );
  });

  it('updates multiple channels in one repository transaction request', async () => {
    const { service, repository } = createService();

    await service.update(userId, {
      appPushEnabled: true,
      smsEnabled: true,
      whatsappEnabled: false,
    });

    expect(repository.update).toHaveBeenCalledWith(userId, {
      APP_PUSH: true,
      SMS: true,
      WHATSAPP: false,
    });
  });
});
