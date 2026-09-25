import { Injectable } from '@nestjs/common';
import { MediaStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface MediaRecord {
  id: string;
  uploaderUserId: string;
  reportId: string;
  storageKey: string;
  contentType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  status: MediaStatus;
  createdAt: Date;
}

export interface MediaMetadataUpdate {
  byteSize: number;
  width: number | null;
  height: number | null;
}

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findReportOwner(reportId: string): Promise<string | null> {
    const report = await this.prisma.floodReport.findUnique({
      where: { id: reportId },
      select: { reporterUserId: true },
    });
    return report?.reporterUserId ?? null;
  }

  async createPending(record: {
    id: string;
    uploaderUserId: string;
    reportId: string;
    storageKey: string;
    contentType: string;
    byteSize: number;
  }): Promise<MediaRecord> {
    return this.prisma.media.create({
      data: {
        id: record.id,
        uploaderUserId: record.uploaderUserId,
        reportId: record.reportId,
        storageKey: record.storageKey,
        contentType: record.contentType,
        byteSize: record.byteSize,
      },
      select: this.selectFields(),
    });
  }

  async findOwnedById(id: string, uploaderUserId: string): Promise<MediaRecord | null> {
    return this.prisma.media.findFirst({
      where: { id, uploaderUserId },
      select: this.selectFields(),
    });
  }

  async findAvailableByIncident(incidentId: string): Promise<MediaRecord[]> {
    return this.prisma.media.findMany({
      where: {
        status: MediaStatus.AVAILABLE,
        report: { incident: { id: incidentId } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: this.selectFields(),
    });
  }

  async markFailed(id: string, uploaderUserId: string): Promise<void> {
    await this.prisma.media.updateMany({
      where: { id, uploaderUserId, status: MediaStatus.PENDING },
      data: { status: MediaStatus.FAILED },
    });
  }

  async markAvailableAndRefreshIncidentPhotoCount(
    id: string,
    uploaderUserId: string,
    metadata: MediaMetadataUpdate,
  ): Promise<MediaRecord | null> {
    return this.prisma.$transaction((transaction) =>
      this.markAvailableWithinTransaction(transaction, id, uploaderUserId, metadata),
    );
  }

  private async markAvailableWithinTransaction(
    transaction: Prisma.TransactionClient,
    id: string,
    uploaderUserId: string,
    metadata: MediaMetadataUpdate,
  ): Promise<MediaRecord | null> {
    const updated = await transaction.media.updateMany({
      where: { id, uploaderUserId, status: MediaStatus.PENDING },
      data: {
        status: MediaStatus.AVAILABLE,
        byteSize: metadata.byteSize,
        width: metadata.width,
        height: metadata.height,
      },
    });

    if (updated.count === 0) {
      return null;
    }

    await transaction.$executeRaw(Prisma.sql`
      UPDATE "incidents" i
      SET "photo_count" = (
        SELECT COUNT(*)::integer
        FROM "media" m
        INNER JOIN "flood_reports" fr ON fr."id" = m."report_id"
        WHERE fr."incident_id" = (
          SELECT "report_id" FROM "media" WHERE "id" = ${id}::uuid
        )
        AND m."status" = CAST('AVAILABLE' AS "MediaStatus")
      ),
      "updated_at" = CURRENT_TIMESTAMP
      WHERE i."id" = (
        SELECT fr."incident_id"
        FROM "media" m
        INNER JOIN "flood_reports" fr ON fr."id" = m."report_id"
        WHERE m."id" = ${id}::uuid
      )
    `);

    return transaction.media.findUnique({
      where: { id },
      select: this.selectFields(),
    });
  }

  private selectFields() {
    return {
      id: true,
      uploaderUserId: true,
      reportId: true,
      storageKey: true,
      contentType: true,
      byteSize: true,
      width: true,
      height: true,
      status: true,
      createdAt: true,
    } as const;
  }
}
