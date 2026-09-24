import { Injectable } from '@nestjs/common';
import { AuthAuditAction } from '@prisma/client';
import type { RequestMeta, PublicUser } from '../auth/auth.types';
import { toPublicUser } from '../auth/public-user.mapper';
import { PrismaService } from '../../database/prisma.service';
import { UpdateBasicProfileDto } from './dto/update-basic-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async updateBasicProfile(
    userId: string,
    dto: UpdateBasicProfileDto,
    meta: RequestMeta,
  ): Promise<PublicUser> {
    const updatedUser = await this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.update({
        where: { id: userId },
        data: { displayName: dto.displayName.trim() },
      });
      await transaction.authAuditLog.create({
        data: {
          userId,
          action: AuthAuditAction.PROFILE_UPDATED,
          ...(meta.ipAddress ? { ipAddress: meta.ipAddress } : {}),
          ...(meta.userAgent ? { userAgent: meta.userAgent.slice(0, 512) } : {}),
        },
      });
      return user;
    });

    return toPublicUser(updatedUser);
  }
}
