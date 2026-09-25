import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class IncidentLifecycleService {
  private readonly communityStaleAfterHours: number;
  private readonly confirmationExtensionHours: number;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.communityStaleAfterHours = configService.getOrThrow<number>(
      'incidentLifecycle.communityStaleAfterHours',
    );
    this.confirmationExtensionHours = configService.getOrThrow<number>(
      'incidentLifecycle.confirmationExtensionHours',
    );
  }

  /** A new community report starts or refreshes the incident's active window. */
  async onReportSubmitted(incidentId: string): Promise<void> {
    await this.extendCommunityIncident(incidentId, this.communityStaleAfterHours);
  }

  /** A confirmation extends only community incidents; official expiry is authoritative. */
  async onIncidentConfirmed(incidentId: string): Promise<void> {
    await this.extendCommunityIncident(incidentId, this.confirmationExtensionHours);
  }

  /**
   * Expires due official incidents and stale community incidents. The active
   * predicate makes this safe to run repeatedly and concurrently.
   */
  async expireStaleIncidents(): Promise<number> {
    return this.prisma.$executeRaw(Prisma.sql`
      UPDATE incidents AS i
      SET status = CAST('EXPIRED' AS "IncidentStatus"),
          expires_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE i.status = CAST('ACTIVE' AS "IncidentStatus")
        AND (
          (i.expires_at IS NOT NULL AND i.expires_at <= CURRENT_TIMESTAMP)
          OR (
            i.source_type::text = 'COMMUNITY'
            AND GREATEST(
              COALESCE(i.last_confirmed_at, i.first_reported_at),
              COALESCE(
                (
                  SELECT MAX(fr.created_at)
                  FROM flood_reports AS fr
                  WHERE fr.incident_id = i.id
                    AND fr.moderation_status::text IN ('PENDING', 'APPROVED')
                ),
                i.first_reported_at
              )
            ) <= CURRENT_TIMESTAMP - (${this.communityStaleAfterHours}::double precision * INTERVAL '1 hour')
          )
        )
    `);
  }

  private async extendCommunityIncident(incidentId: string, hours: number): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE incidents
      SET expires_at = GREATEST(
            COALESCE(expires_at, CURRENT_TIMESTAMP),
            CURRENT_TIMESTAMP + (${hours}::double precision * INTERVAL '1 hour')
          ),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${incidentId}::uuid
        AND status = CAST('ACTIVE' AS "IncidentStatus")
        AND source_type::text = 'COMMUNITY'
    `);
  }
}
