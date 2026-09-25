import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IncidentStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ApplicationError } from '../../common/errors/application.error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { IncidentsService } from '../incidents/incidents.service';
import { INCIDENT_CONFIRMATION_CREATED_JOB } from './incident-confirmations.constants';
import { IncidentConfirmationsRepository } from './incident-confirmations.repository';
import type { IncidentConfirmationResult } from './incident-confirmation.types';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class IncidentConfirmationsService {
  private readonly cooldownSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
    private readonly confirmationsRepository: IncidentConfirmationsRepository,
    private readonly incidentsService: IncidentsService,
    private readonly queueService: QueueService,
    private readonly logger: StructuredLogger,
  ) {
    this.cooldownSeconds = configService.getOrThrow<number>('incidentConfirmation.cooldownSeconds');
  }

  async confirm(
    incidentId: string,
    userId: string,
  ): Promise<IncidentConfirmationResult['incident']> {
    this.assertUuid(incidentId, 'incidentId');
    this.assertUuid(userId, 'userId');

    const result = await this.prisma.$transaction(async (transaction) => {
      const incident = await this.confirmationsRepository.lockIncident(transaction, incidentId);
      if (!incident) {
        throw new NotFoundException('Incident not found');
      }
      if (
        incident.status !== IncidentStatus.ACTIVE ||
        (incident.expiresAt !== null && incident.expiresAt <= incident.databaseNow)
      ) {
        throw new ConflictException('Only active incidents can be confirmed');
      }

      const existing = await this.confirmationsRepository.findByIncidentAndUser(
        transaction,
        incidentId,
        userId,
      );
      const cooldownBoundary = new Date(
        incident.databaseNow.getTime() - this.cooldownSeconds * 1_000,
      );
      const existingConfirmedAt = existing?.lastConfirmedAt ?? existing?.createdAt;

      if (existing && existingConfirmedAt && existingConfirmedAt >= cooldownBoundary) {
        const currentIncident = await this.incidentsService.findByIdInTransaction(
          transaction,
          incidentId,
        );
        if (!currentIncident) {
          throw new NotFoundException('Incident not found');
        }
        return {
          incident: currentIncident,
          confirmationId: existing.id,
          confirmedAt: existingConfirmedAt,
          eventRequired: false,
        } satisfies IncidentConfirmationResult;
      }

      const verificationMetadata = {
        source: 'COMMUNITY_API',
        method: 'MANUAL_CONFIRMATION',
      };
      let confirmationId: string;
      let confirmedAt: Date;

      if (existing) {
        const refreshed = await this.confirmationsRepository.refresh(
          transaction,
          existing.id,
          userId,
          verificationMetadata,
        );
        if (!refreshed) {
          throw new Error('Incident confirmation could not be refreshed');
        }
        confirmationId = refreshed.id;
        confirmedAt = refreshed.lastConfirmedAt ?? incident.databaseNow;
      } else {
        const created = await this.confirmationsRepository.create(
          transaction,
          randomUUID(),
          incidentId,
          userId,
          verificationMetadata,
        );
        confirmationId = created.id;
        confirmedAt = created.createdAt;
      }

      await this.confirmationsRepository.recalculateIncidentAggregate(transaction, incidentId);
      const updatedIncident = await this.incidentsService.findByIdInTransaction(
        transaction,
        incidentId,
      );
      if (!updatedIncident) {
        throw new NotFoundException('Incident not found');
      }

      return {
        incident: updatedIncident,
        confirmationId,
        confirmedAt,
        eventRequired: true,
      } satisfies IncidentConfirmationResult;
    });

    if (result.eventRequired) {
      try {
        await this.queueService.enqueueSystemJob(
          INCIDENT_CONFIRMATION_CREATED_JOB,
          {
            confirmationId: result.confirmationId,
            incidentId,
            userId,
            confirmedAt: result.confirmedAt.toISOString(),
          },
          {
            jobId: `incident-confirmation-${result.confirmationId}-${result.confirmedAt.getTime()}`,
            attempts: 3,
            backoffMs: 1_000,
          },
        );
      } catch (error) {
        this.logger.error(
          error,
          error instanceof Error ? error.stack : undefined,
          'IncidentConfirmationsService.enqueueCreatedJob',
        );
      }
    }

    return result.incident;
  }

  private assertUuid(value: string, field: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new ApplicationError(ErrorCodes.ValidationError, `${field} must be a valid UUID`);
    }
  }
}
