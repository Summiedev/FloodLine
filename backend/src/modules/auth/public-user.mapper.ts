import { ContributorStatus } from '@prisma/client';
import type { PublicUser } from './auth.types';

interface PublicUserSource {
  id: string;
  email: string | null;
  phoneNumber: string | null;
  displayName: string;
  status: PublicUser['status'];
  contributorStatus?: ContributorStatus | { status: ContributorStatus } | null;
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
    contributorStatus:
      user.contributorStatus && typeof user.contributorStatus === 'object'
        ? user.contributorStatus.status
        : (user.contributorStatus ?? ContributorStatus.STANDARD),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}
