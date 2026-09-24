import type { UserStatus } from '@prisma/client';

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface PublicUser {
  id: string;
  email: string | null;
  phoneNumber: string | null;
  displayName: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface AuthPrincipal extends PublicUser {
  sessionId: string;
  userId: string;
}

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
  user: PublicUser;
}

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  jti: string;
  typ: 'access';
}
