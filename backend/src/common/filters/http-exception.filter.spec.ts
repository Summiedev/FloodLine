import { HttpException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  it('does not expose internal messages for server errors', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const request = { requestId: 'request-1' };
    const response = { status };
    const logger = { error: jest.fn() };
    const host = {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter(logger as never).catch(
      new HttpException('database password leaked', 500),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'Internal server error' }),
      }),
    );
    expect(logger.error).toHaveBeenCalled();
  });
});
