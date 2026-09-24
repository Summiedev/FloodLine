import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IncidentSourceType, Prisma } from '@prisma/client';
import { IncidentsService } from '../incidents/incidents.service';
import type { IncidentResponseDto } from '../incidents/incident-response.dto';
import { FloodReportsRepository } from './flood-reports.repository';
import type { FloodReportSubmission } from './flood-report.types';

@Injectable()
export class IncidentAssociationService {
  private readonly associationRadiusMeters: number;
  private readonly associationLookbackMinutes: number;

  constructor(
    configService: ConfigService,
    private readonly floodReportsRepository: FloodReportsRepository,
    private readonly incidentsService: IncidentsService,
  ) {
    this.associationRadiusMeters = configService.getOrThrow<number>(
      'floodReport.associationRadiusMeters',
    );
    this.associationLookbackMinutes = configService.getOrThrow<number>(
      'floodReport.associationLookbackMinutes',
    );
  }

  async associateOrCreate(
    transaction: Prisma.TransactionClient,
    submission: FloodReportSubmission,
  ): Promise<IncidentResponseDto> {
    await this.floodReportsRepository.acquireAssociationLock(
      transaction,
      submission.reportType,
      submission.longitude,
      submission.latitude,
    );

    const compatibleIncidentId = await this.floodReportsRepository.findCompatibleIncident(
      transaction,
      submission.reportType,
      submission.longitude,
      submission.latitude,
      this.associationLookbackMinutes,
      this.associationRadiusMeters,
    );

    if (compatibleIncidentId) {
      await this.floodReportsRepository.touchIncident(transaction, compatibleIncidentId);
      const incident = await this.incidentsService.findByIdInTransaction(
        transaction,
        compatibleIncidentId,
      );
      if (!incident) {
        throw new Error('Compatible incident disappeared during report association');
      }
      return incident;
    }

    return this.incidentsService.createIncidentInTransaction(transaction, {
      incidentType: submission.reportType,
      severity: submission.observedSeverity,
      location: {
        longitude: submission.longitude,
        latitude: submission.latitude,
      },
      locationName: submission.locationName,
      description: submission.description,
      sourceType: IncidentSourceType.COMMUNITY,
    });
  }
}
