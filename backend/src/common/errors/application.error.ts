import { HttpStatus } from '@nestjs/common';

export type ErrorDetails = Record<string, unknown> | unknown[];

export class ApplicationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: HttpStatus = HttpStatus.BAD_REQUEST,
    readonly details?: ErrorDetails,
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}
