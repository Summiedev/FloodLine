import { ApplicationError } from '../../common/errors/application.error';
import { ErrorCodes } from '../../common/errors/error-codes';

export function normalizeEmail(email: string): string {
  const normalized = email.normalize('NFKC').trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) {
    throw new ApplicationError(ErrorCodes.ValidationError, 'A valid email is required');
  }

  return normalized;
}

/**
 * Phone numbers are stored in canonical E.164 form. Phone authentication is
 * intentionally not enabled yet, but all future phone identities must use this
 * function before persistence or lookup.
 */
export function normalizePhoneNumber(phoneNumber: string): string {
  const compact = phoneNumber
    .normalize('NFKC')
    .trim()
    .replace(/[\s().-]/g, '');
  const normalized = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new ApplicationError(
      ErrorCodes.ValidationError,
      'Phone number must be a valid E.164 number',
    );
  }

  return normalized;
}
