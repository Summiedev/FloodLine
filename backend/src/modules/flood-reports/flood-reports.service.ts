import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { ApplicationError } from '../../common/errors/application.error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import { PrismaService } from '../../database/prisma.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { FLOOD_REPORT_CREATED_JOB } from './flood-reports.constants';
import { IncidentAssociationService } from './incident-association.service';
import { FloodReportsRepository } from './flood-reports.repository';
import type {
  FloodReportCreatedJobPayload,
  FloodReportSubmission,
  FloodReportSubmissionResult,
} from './flood-report.types';

@Injectable()
export class FloodReportsService {
  private readonly duplicateWindowSeconds: number;
  private readonly duplicateRadiusMeters: number;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
    private readonly floodReportsRepository: FloodReportsRepository,
    private readonly incidentAssociationService: IncidentAssociationService,
    private readonly queueService: QueueService,
    private readonly logger: StructuredLogger,
  ) {
    this.duplicateWindowSeconds = configService.getOrThrow<number>(
      'floodReport.duplicateWindowSeconds',
    );
    this.duplicateRadiusMeters = configService.getOrThrow<number>(
      'floodReport.duplicateRadiusMeters',
    );
  }

  async submit(submission: FloodReportSubmission): Promise<FloodReportSubmissionResult> {
    this.validateSubmission(submission);
    const reportId = randomUUID();

    const incident = await this.prisma.$transaction(async (transaction) => {
      await this.floodReportsRepository.acquireSubmissionLock(
        transaction,
        submission.reporterUserId,
      );

      const duplicateId = await this.floodReportsRepository.findRecentDuplicate(
        transaction,
        submission,
        this.duplicateWindowSeconds,
        this.duplicateRadiusMeters,
      );
      if (duplicateId) {
        throw new ConflictException('A similar flood report was submitted recently');
      }

      const associatedIncident = await this.incidentAssociationService.associateOrCreate(
        transaction,
        submission,
      );

      await this.floodReportsRepository.createWithinTransaction(transaction, {
        ...submission,
        id: reportId,
        incidentId: associatedIncident.id,
        locationName: submission.locationName.trim(),
        description: submission.description.trim(),
        sourceMetadata: {
          channel: 'COMMUNITY_API',
          apiVersion: 'v1',
        },
      });

      return associatedIncident;
    });

    const jobPayload: FloodReportCreatedJobPayload = {
      reportId,
      incidentId: incident.id,
      reporterUserId: submission.reporterUserId,
    };

    try {
      await this.queueService.enqueueSystemJob(FLOOD_REPORT_CREATED_JOB, jobPayload, {
        jobId: `flood-report-created-${reportId}`,
        attempts: 3,
        backoffMs: 1_000,
      });
    } catch (error) {
      // The report transaction has already committed. Keep the API response
      // successful and make the delivery failure observable for retry tooling.
      this.logger.error(
        error,
        error instanceof Error ? error.stack : undefined,
        'FloodReportsService.enqueueCreatedJob',
      );
    }

    return { reportId, incident };
  }

  private validateSubmission(submission: FloodReportSubmission): void {
    this.assertUuid(submission.reporterUserId, 'reporterUserId');
    if (
      !Number.isFinite(submission.longitude) ||
      submission.longitude < -180 ||
      submission.longitude > 180
    ) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        'longitude must be between -180 and 180',
      );
    }
    if (
      !Number.isFinite(submission.latitude) ||
      submission.latitude < -90 ||
      submission.latitude > 90
    ) {
      throw new ApplicationError(ErrorCodes.ValidationError, 'latitude must be between -90 and 90');
    }
    if (!submission.locationName.trim() || submission.locationName.trim().length > 200) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        'locationName must contain between 1 and 200 characters',
      );
    }
    if (!submission.description.trim() || submission.description.trim().length > 5_000) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        'description must contain between 1 and 5000 characters',
      );
    }
    if (submission.occurredAt && submission.occurredAt > new Date()) {
      throw new ApplicationError(ErrorCodes.ValidationError, 'occurredAt cannot be in the future');
    }
  }

  private assertUuid(value: string, field: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new ApplicationError(ErrorCodes.ValidationError, `${field} must be a valid UUID`);
    }
  }
}
