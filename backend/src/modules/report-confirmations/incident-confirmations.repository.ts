import { Injectable } from '@nestjs/common';
import { IncidentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  ConfirmationAggregate,
  ExistingConfirmation,
  LockedIncident,
} from './incident-confirmation.types';

interface ConfirmationRow {
  id: string;
  createdAt: Date;
  lastConfirmedAt: Date | null;
}

interface LockedIncidentRow {
  id: string;
  status: IncidentStatus;
  expiresAt: Date | null;
  databaseNow: Date;
}

interface AggregateRow {
  confirmationCount: number;
  lastConfirmedAt: Date | null;
}

@Injectable()
export class IncidentConfirmationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async lockIncident(
    transaction: Prisma.TransactionClient,
    incidentId: string,
  ): Promise<LockedIncident | null> {
    const rows = await transaction.$queryRaw<LockedIncidentRow[]>(Prisma.sql`
      SELECT
        i.id::text AS "id",
        i.status AS "status",
        i.expires_at AS "expiresAt",
        CURRENT_TIMESTAMP AS "databaseNow"
      FROM "incidents" i
      WHERE i.id = ${incidentId}::uuid
      FOR UPDATE
    `);
    return rows[0] ?? null;
  }

  async findByIncidentAndUser(
    transaction: Prisma.TransactionClient,
    incidentId: string,
    userId: string,
  ): Promise<ExistingConfirmation | null> {
    const rows = await transaction.$queryRaw<ConfirmationRow[]>(Prisma.sql`
      SELECT
        ic.id::text AS "id",
        ic.created_at AS "createdAt",
        ic.last_confirmed_at AS "lastConfirmedAt"
      FROM "incident_confirmations" ic
      WHERE ic.incident_id = ${incidentId}::uuid
        AND ic.user_id = ${userId}::uuid
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async create(
    transaction: Prisma.TransactionClient,
    confirmationId: string,
    incidentId: string,
    userId: string,
    verificationMetadata: Record<string, string>,
  ): Promise<ExistingConfirmation> {
    const rows = await transaction.$queryRaw<ConfirmationRow[]>(Prisma.sql`
      INSERT INTO "incident_confirmations" (
        "id", "incident_id", "user_id", "verification_metadata"
      ) VALUES (
        ${confirmationId}::uuid,
        ${incidentId}::uuid,
        ${userId}::uuid,
        CAST(${JSON.stringify(verificationMetadata)} AS jsonb)
      )
      RETURNING
        "id"::text AS "id",
        "created_at" AS "createdAt",
        "last_confirmed_at" AS "lastConfirmedAt"
    `);
    if (!rows[0]) {
      throw new Error('Incident confirmation was created but could not be read back');
    }
    return rows[0];
  }

  async refresh(
    transaction: Prisma.TransactionClient,
    confirmationId: string,
    userId: string,
    verificationMetadata: Record<string, string>,
  ): Promise<ExistingConfirmation | null> {
    const rows = await transaction.$queryRaw<ConfirmationRow[]>(Prisma.sql`
      UPDATE "incident_confirmations"
      SET
        "last_confirmed_at" = CURRENT_TIMESTAMP,
        "verification_metadata" = CAST(${JSON.stringify(verificationMetadata)} AS jsonb)
      WHERE "id" = ${confirmationId}::uuid
        AND "user_id" = ${userId}::uuid
      RETURNING
        "id"::text AS "id",
        "created_at" AS "createdAt",
        "last_confirmed_at" AS "lastConfirmedAt"
    `);
    return rows[0] ?? null;
  }

  async recalculateIncidentAggregate(
    transaction: Prisma.TransactionClient,
    incidentId: string,
  ): Promise<ConfirmationAggregate> {
    const rows = await transaction.$queryRaw<AggregateRow[]>(Prisma.sql`
      WITH aggregate AS (
        SELECT
          COUNT(*)::bigint AS "confirmationCount",
          MAX(COALESCE("last_confirmed_at", "created_at")) AS "lastConfirmedAt"
        FROM "incident_confirmations"
        WHERE "incident_id" = ${incidentId}::uuid
      )
      UPDATE "incidents" i
      SET
        "confirmation_count" = aggregate."confirmationCount"::integer,
        "last_confirmed_at" = aggregate."lastConfirmedAt",
        "updated_at" = CURRENT_TIMESTAMP
      FROM aggregate
      WHERE i."id" = ${incidentId}::uuid
      RETURNING
        i."confirmation_count"::integer AS "confirmationCount",
        i."last_confirmed_at" AS "lastConfirmedAt"
    `);
    if (!rows[0]) {
      throw new Error('Incident confirmation aggregate could not be recalculated');
    }
    return {
      confirmationCount: rows[0].confirmationCount,
      lastConfirmedAt: rows[0].lastConfirmedAt,
    };
  }
}
