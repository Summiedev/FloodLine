import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IncidentSeverity } from '@prisma/client';
import { RouteRiskRepository } from './route-risk.repository';
import type {
  RouteLineString,
  RouteRiskIncidentSummary,
  RouteRiskLevel,
  RouteRiskResult,
} from './routing.types';

/**
 * Transparent route-risk model. Each incident contributes:
 * severity weight × confidence factor × recency factor × source factor × corridor-distance factor.
 * Contributions are combined as independent evidence (1 - product(1 - contribution)), then
 * bounded to 0..1. This is reported flood evidence, not a physical-safety guarantee.
 */
@Injectable()
export class RouteRiskService {
  private readonly corridorMeters: number;
  private readonly recentWindowMs: number;
  private readonly lowThreshold: number;
  private readonly highThreshold: number;

  constructor(
    private readonly repository: RouteRiskRepository,
    configService: ConfigService,
  ) {
    this.corridorMeters = configService.getOrThrow<number>('routeRisk.corridorMeters');
    this.recentWindowMs =
      configService.getOrThrow<number>('routeRisk.recentWindowHours') * 60 * 60 * 1_000;
    this.lowThreshold = configService.getOrThrow<number>('routeRisk.lowThreshold');
    this.highThreshold = configService.getOrThrow<number>('routeRisk.highThreshold');
  }

  async evaluate(geometry: RouteLineString, now = new Date()): Promise<RouteRiskResult> {
    const incidents = await this.repository.findActiveIncidentsNearRoute(
      geometry,
      this.corridorMeters,
    );
    const riskScore = this.roundScore(
      1 -
        incidents.reduce(
          (remaining, incident) => remaining * (1 - this.contribution(incident, now)),
          1,
        ),
    );
    const riskLevel = this.levelFor(riskScore);

    return {
      riskScore,
      riskLevel,
      affectingIncidentCount: incidents.length,
      severeIncidentCount: incidents.filter(
        (incident) => incident.severity === IncidentSeverity.SEVERE,
      ).length,
      avoidedIncidentCount: null,
      incidents: incidents.map((incident) => ({
        id: incident.id,
        incidentType: incident.incidentType,
        severity: incident.severity,
        confidenceLabel: incident.confidenceLabel,
        sourceType: incident.sourceType,
        locationName: incident.locationName,
        distanceMeters: this.roundDistance(incident.distanceMeters),
        updatedAt: incident.updatedAt,
      })),
      summary:
        incidents.length === 0
          ? 'No currently known reports'
          : riskLevel === 'LOW'
            ? 'Lower reported flood risk'
            : 'Flood reports detected',
    };
  }

  private contribution(incident: RouteRiskIncidentSummary, now: Date): number {
    const severityWeight: Record<IncidentSeverity, number> = {
      [IncidentSeverity.LOW]: 0.1,
      [IncidentSeverity.MODERATE]: 0.3,
      [IncidentSeverity.HIGH]: 0.65,
      [IncidentSeverity.SEVERE]: 1,
    };
    const confidenceFactor: Record<string, number> = { LOW: 0.5, MEDIUM: 0.75, HIGH: 1 };
    const ageMs = Math.max(0, now.getTime() - incident.updatedAt.getTime());
    const recencyFactor = 0.25 + 0.75 * Math.max(0, 1 - ageMs / this.recentWindowMs);
    const distanceFactor = Math.max(0.1, 1 - incident.distanceMeters / this.corridorMeters);
    const sourceFactor = incident.sourceType === 'OFFICIAL' ? 1.15 : 1;
    return Math.min(
      1,
      severityWeight[incident.severity as IncidentSeverity] *
        (confidenceFactor[incident.confidenceLabel] ?? 0.5) *
        recencyFactor *
        distanceFactor *
        sourceFactor,
    );
  }

  private levelFor(score: number): RouteRiskLevel {
    if (score >= this.highThreshold) return 'HIGH';
    if (score >= this.lowThreshold) return 'MODERATE';
    return 'LOW';
  }

  private roundScore(value: number): number {
    return Math.round(Math.min(1, Math.max(0, value)) * 1_000) / 1_000;
  }

  private roundDistance(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
