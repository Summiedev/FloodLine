import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { CommunityImpactResponse } from './community-impact.types';

interface ImpactRow {
  reportsSubmitted: number | bigint;
  confirmationsMade: number | bigint;
  peopleHelped: number | bigint;
  alertRecipientsFromContributedIncidents: number | bigint;
}

@Injectable()
export class CommunityImpactRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getForUser(userId: string): Promise<CommunityImpactResponse> {
    const rows = await this.prisma.$queryRaw<ImpactRow[]>(Prisma.sql`
      WITH contributed_incidents AS (
        SELECT DISTINCT fr."incident_id" AS "incidentId"
        FROM "flood_reports" fr
        WHERE fr."reporter_user_id" = ${userId}::uuid
          AND fr."moderation_status" <> CAST('REJECTED' AS "FloodReportModerationStatus")
        UNION
        SELECT DISTINCT ic."incident_id" AS "incidentId"
        FROM "incident_confirmations" ic
        WHERE ic."user_id" = ${userId}::uuid
      ),
      report_counts AS (
        SELECT COUNT(*)::integer AS "reportsSubmitted"
        FROM "flood_reports" fr
        WHERE fr."reporter_user_id" = ${userId}::uuid
          AND fr."moderation_status" <> CAST('REJECTED' AS "FloodReportModerationStatus")
      ),
      confirmation_counts AS (
        SELECT COUNT(*)::integer AS "confirmationsMade"
        FROM "incident_confirmations" ic
        WHERE ic."user_id" = ${userId}::uuid
      ),
      recipient_counts AS (
        SELECT
          COUNT(DISTINCT n."user_id")::integer AS "peopleHelped",
          COUNT(DISTINCT (n."incident_id", n."user_id"))::integer AS "alertRecipientsFromContributedIncidents"
        FROM "notifications" n
        INNER JOIN contributed_incidents ci ON ci."incidentId" = n."incident_id"
        WHERE n."incident_id" IS NOT NULL
          AND n."user_id" <> ${userId}::uuid
      )
      SELECT
        rc."reportsSubmitted",
        cc."confirmationsMade",
        COALESCE(pc."peopleHelped", 0) AS "peopleHelped",
        COALESCE(pc."alertRecipientsFromContributedIncidents", 0) AS "alertRecipientsFromContributedIncidents"
      FROM report_counts rc
      CROSS JOIN confirmation_counts cc
      CROSS JOIN recipient_counts pc
    `);
    const row = rows[0];
    return {
      reportsSubmitted: Number(row?.reportsSubmitted ?? 0),
      confirmationsMade: Number(row?.confirmationsMade ?? 0),
      peopleHelped: Number(row?.peopleHelped ?? 0),
      alertRecipientsFromContributedIncidents: Number(
        row?.alertRecipientsFromContributedIncidents ?? 0,
      ),
    };
  }
}
