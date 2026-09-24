import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthAuditAction, Prisma, UserStatus } from '@prisma/client';
import type {
  RequestMeta,
  AccessTokenPayload,
  AuthPrincipal,
  AuthTokenResponse,
} from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { normalizeEmail } from './identity-normalization';
import { PasswordHasher } from './password-hasher.service';
import { toPublicUser } from './public-user.mapper';
import { PrismaService } from '../../database/prisma.service';

interface SessionIssue {
  sessionId: string;
  refreshToken: string;
  expiresAt: Date;
  lastLoginAt: Date | null;
}

@Injectable()
export class AuthService {
  private readonly accessTokenTtl: string;
  private readonly refreshTokenTtlDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly passwordHasher: PasswordHasher,
    configService: ConfigService,
  ) {
    this.accessTokenTtl = configService.getOrThrow<string>('auth.accessTokenTtl');
    this.refreshTokenTtlDays = configService.getOrThrow<number>('auth.refreshTokenTtlDays');
  }

  async register(dto: RegisterDto, meta: RequestMeta): Promise<AuthTokenResponse> {
    const email = normalizeEmail(dto.email);
    const passwordHash = await this.passwordHasher.hash(dto.password);
    const displayName = dto.displayName.trim();

    try {
      const result = await this.prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            email,
            displayName,
            passwordCredential: { create: { passwordHash } },
          },
        });
        const session = await this.createSession(
          transaction,
          user.id,
          AuthAuditAction.REGISTERED,
          email,
          meta,
        );
        return { user, session };
      });

      return this.createTokenResponse(
        { ...result.user, lastLoginAt: result.session.lastLoginAt },
        result.session,
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('An account with that email already exists');
      }
      throw error;
    }
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<AuthTokenResponse> {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { passwordCredential: true },
    });
    const passwordValid = await this.passwordHasher.verify(
      user?.passwordCredential?.passwordHash,
      dto.password,
    );

    if (!user || !passwordValid || user.status !== UserStatus.ACTIVE) {
      await this.recordAudit(user?.id ?? null, AuthAuditAction.LOGIN_FAILED, email, meta);
      throw new UnauthorizedException('Invalid credentials');
    }

    const session = await this.prisma.$transaction((transaction) =>
      this.createSession(transaction, user.id, AuthAuditAction.LOGIN_SUCCEEDED, email, meta),
    );

    return this.createTokenResponse({ ...user, lastLoginAt: session.lastLoginAt }, session);
  }

  async refresh(dto: RefreshTokenDto, meta: RequestMeta): Promise<AuthTokenResponse> {
    const currentHash = this.hashRefreshToken(dto.refreshToken);
    const now = new Date();
    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash: currentHash },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt <= now ||
      session.user.status !== UserStatus.ACTIVE
    ) {
      await this.recordAudit(
        session?.userId ?? null,
        AuthAuditAction.TOKEN_REFRESH_FAILED,
        session?.user.email ?? null,
        meta,
      );
      throw new UnauthorizedException('Invalid refresh token');
    }

    const nextRefreshToken = this.createRefreshToken();
    const nextHash = this.hashRefreshToken(nextRefreshToken);

    try {
      await this.prisma.$transaction(async (transaction) => {
        const rotated = await transaction.authSession.updateMany({
          where: {
            id: session.id,
            refreshTokenHash: currentHash,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: {
            refreshTokenHash: nextHash,
            lastUsedAt: now,
          },
        });

        if (rotated.count !== 1) {
          throw new UnauthorizedException('Invalid refresh token');
        }

        await transaction.authAuditLog.create({
          data: {
            userId: session.userId,
            action: AuthAuditAction.TOKEN_REFRESHED,
            identity: session.user.email,
            ...this.auditMeta(meta),
          },
        });
      });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw error;
    }

    return this.createTokenResponse(session.user, {
      sessionId: session.id,
      refreshToken: nextRefreshToken,
      expiresAt: session.expiresAt,
      lastLoginAt: session.user.lastLoginAt,
    });
  }

  async logout(userId: string, sessionId: string, meta: RequestMeta): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (transaction) => {
      const revoked = await transaction.authSession.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: now, lastUsedAt: now },
      });

      if (revoked.count !== 1) {
        throw new UnauthorizedException('Session is no longer active');
      }

      await transaction.authAuditLog.create({
        data: {
          userId,
          action: AuthAuditAction.LOGOUT,
          ...this.auditMeta(meta),
        },
      });
    });
  }

  async validateAccessToken(token: string): Promise<AuthPrincipal> {
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    if (!payload.sub || !payload.sid || !payload.jti || payload.typ !== 'access') {
      throw new UnauthorizedException('Invalid access token');
    }

    const session = await this.prisma.authSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { status: UserStatus.ACTIVE },
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            email: true,
            phoneNumber: true,
            displayName: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            lastLoginAt: true,
          },
        },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid access token');
    }

    return {
      ...toPublicUser(session.user),
      userId: session.user.id,
      sessionId: session.id,
    };
  }

  private async createSession(
    transaction: Prisma.TransactionClient,
    userId: string,
    action: AuthAuditAction,
    identity: string | null,
    meta: RequestMeta,
  ): Promise<SessionIssue> {
    const now = new Date();
    const refreshToken = this.createRefreshToken();
    const sessionId = randomUUID();
    const expiresAt = new Date(now.getTime() + this.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

    await transaction.authSession.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenHash: this.hashRefreshToken(refreshToken),
        expiresAt,
        lastUsedAt: now,
        ...this.auditMeta(meta),
      },
    });
    await transaction.user.update({
      where: { id: userId },
      data: { lastLoginAt: now },
    });
    await transaction.authAuditLog.create({
      data: {
        userId,
        action,
        identity,
        ...this.auditMeta(meta),
      },
    });

    return { sessionId, refreshToken, expiresAt, lastLoginAt: now };
  }

  private async createTokenResponse(
    user: Parameters<typeof toPublicUser>[0],
    session: SessionIssue,
  ): Promise<AuthTokenResponse> {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      sid: session.sessionId,
      jti: randomUUID(),
      typ: 'access',
    });

    return {
      accessToken,
      refreshToken: session.refreshToken,
      accessTokenExpiresIn: this.accessTokenTtl,
      user: toPublicUser(user),
    };
  }

  private async recordAudit(
    userId: string | null,
    action: AuthAuditAction,
    identity: string | null,
    meta: RequestMeta,
  ): Promise<void> {
    await this.prisma.authAuditLog.create({
      data: {
        userId,
        action,
        identity,
        ...this.auditMeta(meta),
      },
    });
  }

  private auditMeta(meta: RequestMeta): {
    ipAddress?: string;
    userAgent?: string;
  } {
    return {
      ...(meta.ipAddress && isIP(meta.ipAddress) !== 0 ? { ipAddress: meta.ipAddress } : {}),
      ...(meta.userAgent ? { userAgent: meta.userAgent.slice(0, 512) } : {}),
    };
  }

  private createRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
