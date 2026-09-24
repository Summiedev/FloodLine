import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthAuditAction, Prisma, UserStatus } from '@prisma/client';
import { AuthService } from './auth.service';

const user = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'person@example.com',
  phoneNumber: null,
  displayName: 'Person',
  status: UserStatus.ACTIVE,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  lastLoginAt: null,
};

function createHarness() {
  const transaction = {
    user: {
      create: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue({ ...user, lastLoginAt: new Date() }),
    },
    authSession: {
      create: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    authAuditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    $transaction: jest
      .fn()
      .mockImplementation((callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    user: {
      findUnique: jest.fn(),
    },
    authSession: {
      findUnique: jest.fn(),
    },
    authAuditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('access-token'),
  };
  const passwordHasher = {
    hash: jest.fn().mockResolvedValue('argon2id-hash'),
    verify: jest.fn().mockResolvedValue(true),
  };
  const configService = {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, string | number> = {
        'auth.accessTokenTtl': '15m',
        'auth.refreshTokenTtlDays': 30,
      };
      return values[key];
    }),
  };

  return {
    service: new AuthService(
      prisma as never,
      jwtService as never,
      passwordHasher,
      configService as never,
    ),
    transaction,
    prisma,
    jwtService,
    passwordHasher,
  };
}

describe('AuthService', () => {
  it('registers a normalized email and returns tokens without credential fields', async () => {
    const harness = createHarness();

    const result = await harness.service.register(
      { email: ' Person@Example.com ', password: 'a-secure-password', displayName: 'Person' },
      { ipAddress: '127.0.0.1' },
    );

    expect(harness.transaction.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'person@example.com',
        passwordCredential: { create: { passwordHash: 'argon2id-hash' } },
      }),
    });
    expect(result).toEqual(
      expect.objectContaining({
        accessToken: 'access-token',
        refreshToken: expect.any(String),
        user: expect.not.objectContaining({ passwordHash: expect.anything() }),
      }),
    );
    expect(harness.transaction.authAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: AuthAuditAction.REGISTERED }),
      }),
    );
  });

  it('prevents duplicate identities through the database unique constraint', async () => {
    const harness = createHarness();
    harness.transaction.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
    );

    await expect(
      harness.service.register(
        { email: 'person@example.com', password: 'a-secure-password', displayName: 'Person' },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid credentials without creating a session', async () => {
    const harness = createHarness();
    harness.prisma.user.findUnique.mockResolvedValue(null);
    harness.passwordHasher.verify.mockResolvedValue(false);

    await expect(
      harness.service.login({ email: 'person@example.com', password: 'wrong-password' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(harness.transaction.authSession.create).not.toHaveBeenCalled();
    expect(harness.prisma.authAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: AuthAuditAction.LOGIN_FAILED }),
      }),
    );
  });

  it('logs in a valid user and creates a refresh session', async () => {
    const harness = createHarness();
    harness.prisma.user.findUnique.mockResolvedValue({
      ...user,
      passwordCredential: { passwordHash: 'argon2id-hash' },
    });

    const result = await harness.service.login(
      { email: 'person@example.com', password: 'a-secure-password' },
      {},
    );

    expect(result.accessToken).toBe('access-token');
    expect(harness.transaction.authSession.create).toHaveBeenCalled();
    expect(harness.transaction.authAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: AuthAuditAction.LOGIN_SUCCEEDED }),
      }),
    );
  });

  it('rotates refresh tokens and never persists the raw token', async () => {
    const harness = createHarness();
    const refreshToken = 'r'.repeat(64);
    harness.prisma.authSession.findUnique.mockResolvedValue({
      id: 'session-id',
      userId: user.id,
      refreshTokenHash: 'old-hash',
      createdAt: user.createdAt,
      expiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: null,
      lastUsedAt: null,
      ipAddress: null,
      userAgent: null,
      user,
    });

    const result = await harness.service.refresh({ refreshToken }, {});

    expect(result.refreshToken).not.toBe(refreshToken);
    expect(harness.transaction.authSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          refreshTokenHash: expect.not.stringMatching(result.refreshToken),
        }),
      }),
    );
    expect(harness.transaction.authAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: AuthAuditAction.TOKEN_REFRESHED }),
      }),
    );
  });

  it('revokes the current session during logout', async () => {
    const harness = createHarness();

    await harness.service.logout(user.id, 'session-id', { ipAddress: '127.0.0.1' });

    expect(harness.transaction.authSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-id', userId: user.id, revokedAt: null },
      data: expect.objectContaining({ revokedAt: expect.any(Date) }),
    });
    expect(harness.transaction.authAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: AuthAuditAction.LOGOUT }),
      }),
    );
  });
});
