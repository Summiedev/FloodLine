import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AccessTokenGuard } from './auth.guard';

describe('AccessTokenGuard', () => {
  it('attaches the validated principal to the request', async () => {
    const principal = {
      userId: 'user-1',
      sessionId: 'session-1',
      id: 'user-1',
      email: 'person@example.com',
      phoneNumber: null,
      displayName: 'Person',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: new Date(),
    } as const;
    const authService = {
      validateAccessToken: jest.fn().mockResolvedValue(principal),
    };
    const request = {
      header: jest.fn().mockReturnValue('Bearer access-token'),
    } as never;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const guard = new AccessTokenGuard(authService as never);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect((request as { user?: unknown }).user).toEqual(principal);
    expect(authService.validateAccessToken).toHaveBeenCalledWith('access-token');
  });

  it('rejects requests without a bearer token', async () => {
    const request = { header: jest.fn().mockReturnValue(undefined) } as never;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const guard = new AccessTokenGuard({} as never);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
