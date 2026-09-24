import type { PublicUser } from './auth.types';

interface PublicUserSource {
  id: string;
  email: string | null;
  phoneNumber: string | null;
  displayName: string;
  status: PublicUser['status'];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export function toPublicUser(user: PublicUserSource): PublicUser {
  return {
    id: user.id,
    email: user.email,
    phoneNumber: user.phoneNumber,
    displayName: user.displayName,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}
