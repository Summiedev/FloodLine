import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContributorStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  type ContributorStatusAssignmentResponse,
  type ContributorStatusResponse,
  type ContributorTrustDatabase,
  type ContributorTrustProvider,
} from './contributor-status.types';
import type { UpdateContributorStatusDto } from './dto/update-contributor-status.dto';

@Injectable()
export class ContributorStatusService implements ContributorTrustProvider {
  private readonly adminUserIds: Set<string>;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.adminUserIds = new Set(
      configService
        .getOrThrow<string[]>('contributor.adminUserIds')
        .map((userId) => userId.toLowerCase()),
    );
  }

  async getForUser(userId: string): Promise<ContributorStatusResponse> {
    const record = await this.prisma.userContributorStatus.findUnique({
      where: { userId },
      select: { status: true },
    });
    return { status: record?.status ?? ContributorStatus.STANDARD };
  }

  async assignStatus(
    actorUserId: string,
    targetUserId: string,
    dto: UpdateContributorStatusDto,
  ): Promise<ContributorStatusAssignmentResponse> {
    if (!this.adminUserIds.has(actorUserId.toLowerCase())) {
      throw new ForbiddenException('Contributor-status administration is restricted');
    }
    if (actorUserId.toLowerCase() === targetUserId.toLowerCase()) {
      throw new ForbiddenException('Administrators cannot promote or suspend themselves');
    }

    return this.prisma.$transaction(async (transaction) => {
      const target = await transaction.user.findUnique({ where: { id: targetUserId } });
      if (!target) throw new NotFoundException('User not found');

      const current = await transaction.userContributorStatus.findUnique({
        where: { userId: targetUserId },
      });
      const reason = dto.reason?.trim() || null;
      const status = await transaction.userContributorStatus.upsert({
        where: { userId: targetUserId },
        create: {
          userId: targetUserId,
          status: dto.status,
          assignedBy: actorUserId,
          reason,
        },
        update: {
          status: dto.status,
          assignedAt: new Date(),
          assignedBy: actorUserId,
          reason,
        },
      });

      if (!current || current.status !== dto.status || current.reason !== reason) {
        await transaction.contributorStatusAudit.create({
          data: {
            userId: targetUserId,
            previousStatus: current?.status,
            newStatus: dto.status,
            assignedBy: actorUserId,
            reason,
          },
        });
      }

      return {
        userId: status.userId,
        status: status.status,
        assignedAt: status.assignedAt,
        assignedBy: status.assignedBy ?? actorUserId,
        reason: status.reason,
      };
    });
  }

  async getIncidentTrustedContributorWeight(
    database: ContributorTrustDatabase,
    incidentId: string,
  ): Promise<number> {
    const rows = await database.$queryRaw<Array<{ trustedWeight: number | string }>>(Prisma.sql`
      WITH contributors AS (
        SELECT DISTINCT fr."reporter_user_id" AS "userId"
        FROM "flood_reports" fr
        WHERE fr."incident_id" = ${incidentId}::uuid
          AND fr."moderation_status" <> CAST('REJECTED' AS "FloodReportModerationStatus")
        UNION
        SELECT DISTINCT ic."user_id" AS "userId"
        FROM "incident_confirmations" ic
        WHERE ic."incident_id" = ${incidentId}::uuid
      )
      SELECT COALESCE(AVG(
        CASE WHEN ucs."status" = CAST('VERIFIED' AS "ContributorStatus") THEN 1.0 ELSE 0.0 END
      ), 0)::double precision AS "trustedWeight"
      FROM contributors c
      LEFT JOIN "user_contributor_statuses" ucs ON ucs."user_id" = c."userId"
    `);
    return Math.min(1, Math.max(0, Number(rows[0]?.trustedWeight ?? 0)));
  }
}
