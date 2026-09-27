import { ApplicationError } from '../../common/errors/application.error';
import { ErrorCodes } from '../../common/errors/error-codes';

/** Accepts canonical international numbers only; local numbers need geocoding/product context. */
export function normalizeE164(value: string): string {
  const normalized = value.trim().replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new ApplicationError(
      ErrorCodes.ValidationError,
      'phoneNumber must be a valid E.164 phone number',
    );
  }
  return normalized;
}

export function maskPhoneNumber(value: string): string {
  if (value.length <= 6) return '+******';
  return `${value.slice(0, 4)}******${value.slice(-3)}`;
}
