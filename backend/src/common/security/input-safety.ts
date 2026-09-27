import { ApplicationError } from '../errors/application.error';
import { ErrorCodes } from '../errors/error-codes';

/** Rejects control characters that can corrupt logs, parsers, or downstream rendering. */
export function assertSafeText(value: string, field: string): void {
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value)) {
    throw new ApplicationError(
      ErrorCodes.ValidationError,
      `${field} contains unsupported control characters`,
    );
  }
}
