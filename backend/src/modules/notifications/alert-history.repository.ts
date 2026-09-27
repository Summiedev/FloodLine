import { Injectable } from '@nestjs/common';
import { IncidentSeverity, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  createPaginationMeta,
  type PaginatedResponse,
} from '../../common/pagination/pagination.dto';
import type { AlertHistoryResponse } from './alert-history.types';

export interface AlertHistoryFilter {
  userId: string;
  page: number;
  pageSize: number;
  unread?: boolean;
  severity?: IncidentSeverity;
  category?: NotificationType;
}

@Injectable()
export class AlertHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter: AlertHistoryFilter): Promise<PaginatedResponse<AlertHistoryResponse>> {
    const conditions = [Prisma.sql`n."user_id" = ${filter.userId}::uuid`];
    if (filter.unread === true) conditions.push(Prisma.sql`n."read_at" IS NULL`);
    if (filter.unread === false) conditions.push(Prisma.sql`n."read_at" IS NOT NULL`);
    if (filter.severity) {
      conditions.push(Prisma.sql`n."severity" = CAST(${filter.severity} AS "IncidentSeverity")`);
    }
    if (filter.category) {
      conditions.push(
        Prisma.sql`n."notification_type" = CAST(${filter.category} AS "NotificationType")`,
      );
    }
    const where = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

    const countRows = await this.prisma.$queryRaw<
      Array<{ totalItems: number | bigint }>
    >(Prisma.sql`
      SELECT COUNT(*)::integer AS "totalItems"
      FROM "notifications" n
      ${where}
    `);
    const rows = await this.prisma.$queryRaw<AlertHistoryResponse[]>(Prisma.sql`
      SELECT
        n."id"::text AS "id",
        n."notification_type" AS "category",
        n."severity" AS "severity",
        n."incident_id"::text AS "incidentId",
        n."official_warning_id"::text AS "officialWarningId",
        n."saved_place_id"::text AS "savedPlaceId",
        n."title" AS "title",
        n."body" AS "body",
        n."created_at" AS "createdAt",
        n."read_at" AS "readAt"
      FROM "notifications" n
      ${where}
      ORDER BY n."created_at" DESC, n."id" DESC
      LIMIT ${filter.pageSize}
      OFFSET ${(filter.page - 1) * filter.pageSize}
    `);
    const totalItems = Number(countRows[0]?.totalItems ?? 0);
    return {
      data: rows,
      meta: createPaginationMeta(filter.page, filter.pageSize, totalItems),
    };
  }

  async findOwnedById(userId: string, alertId: string): Promise<AlertHistoryResponse | null> {
    const rows = await this.prisma.$queryRaw<AlertHistoryResponse[]>(Prisma.sql`
      SELECT
        n."id"::text AS "id",
        n."notification_type" AS "category",
        n."severity" AS "severity",
        n."incident_id"::text AS "incidentId",
        n."official_warning_id"::text AS "officialWarningId",
        n."saved_place_id"::text AS "savedPlaceId",
        n."title" AS "title",
        n."body" AS "body",
        n."created_at" AS "createdAt",
        n."read_at" AS "readAt"
      FROM "notifications" n
      WHERE n."id" = ${alertId}::uuid AND n."user_id" = ${userId}::uuid
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async markRead(userId: string, alertId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "notifications"
      SET "read_at" = COALESCE("read_at", CURRENT_TIMESTAMP),
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${alertId}::uuid AND "user_id" = ${userId}::uuid
      RETURNING "id"::text AS "id"
    `);
    return Boolean(rows[0]);
  }

  async markAllRead(userId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "notifications"
      SET "read_at" = CURRENT_TIMESTAMP,
          "updated_at" = CURRENT_TIMESTAMP
      WHERE "user_id" = ${userId}::uuid AND "read_at" IS NULL
      RETURNING "id"::text AS "id"
    `);
    return rows.length;
  }
}
