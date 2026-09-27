import { DeviceTokenCipher } from './device-token-cipher';

describe('DeviceTokenCipher', () => {
  it('encrypts and decrypts device tokens without storing plaintext', () => {
    const cipher = new DeviceTokenCipher({
      getOrThrow: jest.fn().mockReturnValue('a'.repeat(32)),
    } as never);
    const encrypted = cipher.encrypt('push-token-secret');
    expect(encrypted).not.toContain('push-token-secret');
    expect(cipher.decrypt(encrypted)).toBe('push-token-secret');
  });

  it('rejects malformed ciphertext', () => {
    const cipher = new DeviceTokenCipher({
      getOrThrow: jest.fn().mockReturnValue('a'.repeat(32)),
    } as never);
    expect(() => cipher.decrypt('plaintext-token')).toThrow();
  });
});
