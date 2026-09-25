import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { IncidentConfidenceEvidence } from './incident-confidence.types';

interface ConfidenceEvidenceRow {
  sourceType: string;
  uniqueConfirmations: bigint | number;
  recentReports: bigint | number;
  recentConfirmations: bigint | number;
  distinctReporters: bigint | number;
  photoEvidence: bigint | number;
  incidentAgeHours: number | string;
}

export type ConfidenceTransaction = Prisma.TransactionClient | PrismaService;

@Injectable()
export class IncidentConfidenceRepository {
  async getEvidence(
    database: ConfidenceTransaction,
    incidentId: string,
    recentReportWindowHours: number,
    recentConfirmationWindowHours: number,
  ): Promise<IncidentConfidenceEvidence | null> {
    const rows = await database.$queryRaw<ConfidenceEvidenceRow[]>(Prisma.sql`
      SELECT
        i.source_type::text AS "sourceType",
        COUNT(DISTINCT ic.user_id) FILTER (WHERE ic.id IS NOT NULL) AS "uniqueConfirmations",
        COUNT(DISTINCT fr.id) FILTER (
          WHERE fr.moderation_status::text IN ('PENDING', 'APPROVED')
            AND fr.created_at >= CURRENT_TIMESTAMP - (${recentReportWindowHours}::double precision * INTERVAL '1 hour')
        ) AS "recentReports",
        COUNT(DISTINCT ic.id) FILTER (
          WHERE COALESCE(ic.last_confirmed_at, ic.created_at) >= CURRENT_TIMESTAMP - (${recentConfirmationWindowHours}::double precision * INTERVAL '1 hour')
        ) AS "recentConfirmations",
        COUNT(DISTINCT fr.reporter_user_id) FILTER (
          WHERE fr.moderation_status::text IN ('PENDING', 'APPROVED')
        ) AS "distinctReporters",
        COUNT(DISTINCT m.id) FILTER (
          WHERE fr.moderation_status::text IN ('PENDING', 'APPROVED')
            AND m.status::text = 'AVAILABLE'
        ) AS "photoEvidence",
        GREATEST(
          0,
          EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - i.first_reported_at)) / 3600
        ) AS "incidentAgeHours"
      FROM incidents i
      LEFT JOIN flood_reports fr ON fr.incident_id = i.id
      LEFT JOIN incident_confirmations ic ON ic.incident_id = i.id
      LEFT JOIN media m ON m.report_id = fr.id
      WHERE i.id = ${incidentId}::uuid
      GROUP BY i.id, i.source_type, i.first_reported_at
    `);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      sourceType: row.sourceType as IncidentConfidenceEvidence['sourceType'],
      uniqueConfirmations: this.toNumber(row.uniqueConfirmations),
      recentReports: this.toNumber(row.recentReports),
      recentConfirmations: this.toNumber(row.recentConfirmations),
      distinctReporters: this.toNumber(row.distinctReporters),
      photoEvidence: this.toNumber(row.photoEvidence),
      // The current schema has no contributor trust registry yet. The scoring
      // input remains explicit so a later trust domain can supply this signal.
      trustedContributorWeight: 0,
      officialInformationWeight: row.sourceType === 'OFFICIAL' ? 1 : 0,
      contradictoryReports: 0,
      resolutionReports: 0,
      incidentAgeHours: Math.max(0, this.toNumber(row.incidentAgeHours)),
    };
  }

  async updateConfidence(
    database: ConfidenceTransaction,
    incidentId: string,
    score: number,
    label: string,
  ): Promise<void> {
    await database.$executeRaw(Prisma.sql`
      UPDATE incidents
      SET confidence_score = ${score},
          confidence_label = CAST(${label} AS "IncidentConfidenceLabel"),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${incidentId}::uuid
    `);
  }

  private toNumber(value: bigint | number | string): number {
    return typeof value === 'bigint' ? Number(value) : Number(value);
  }
}
