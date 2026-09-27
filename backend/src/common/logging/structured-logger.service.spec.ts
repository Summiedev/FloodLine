import { StructuredLogger } from './structured-logger.service';

describe('StructuredLogger', () => {
  it('redacts credential-shaped fields and values', () => {
    const output = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const logger = new StructuredLogger();

    logger.log(
      {
        accessToken: 'access-token-secret',
        nested: { otp: '123456' },
        message: 'Authorization: Bearer jwt-secret',
      },
      'test',
    );

    const serialized = String(output.mock.calls[0]?.[0]);
    expect(serialized).not.toContain('access-token-secret');
    expect(serialized).not.toContain('123456');
    expect(serialized).not.toContain('jwt-secret');
    expect(serialized).toContain('[REDACTED]');
    output.mockRestore();
  });
});
