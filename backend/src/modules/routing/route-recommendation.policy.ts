import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RoutePreviewRoute, RouteRecommendationReason } from './routing.types';

export interface RouteRecommendationResult {
  routes: RoutePreviewRoute[];
  recommendedRouteId: string | null;
}

/**
 * Selects a route using configurable risk, duration, and distance costs. The duration overhead
 * guard prevents a drastically longer route from winning solely because its reported risk is lower.
 * This policy ranks alternatives; it does not assert that any route is safe.
 */
@Injectable()
export class RouteRecommendationPolicy {
  private readonly riskWeight: number;
  private readonly durationWeight: number;
  private readonly distanceWeight: number;
  private readonly maximumDurationOverheadRatio: number;
  private readonly minimumRiskImprovement: number;

  constructor(configService: ConfigService) {
    this.riskWeight = configService.getOrThrow<number>('routeRecommendation.riskWeight');
    this.durationWeight = configService.getOrThrow<number>('routeRecommendation.durationWeight');
    this.distanceWeight = configService.getOrThrow<number>('routeRecommendation.distanceWeight');
    this.maximumDurationOverheadRatio = configService.getOrThrow<number>(
      'routeRecommendation.maximumDurationOverheadRatio',
    );
    this.minimumRiskImprovement = configService.getOrThrow<number>(
      'routeRecommendation.minimumRiskImprovement',
    );
  }

  recommend(routes: RoutePreviewRoute[]): RouteRecommendationResult {
    if (routes.length === 0) return { routes: [], recommendedRouteId: null };

    const fastestDuration = Math.min(...routes.map((route) => route.durationSeconds));
    const shortestDistance = Math.min(...routes.map((route) => route.distanceMeters));
    const eligible = routes.filter(
      (route) =>
        route.durationSeconds <= fastestDuration * (1 + this.maximumDurationOverheadRatio) ||
        routes.length === 1,
    );
    const pool = eligible.length > 0 ? eligible : routes;
    const selected = [...pool].sort(
      (a, b) =>
        this.combinedCost(a, fastestDuration, shortestDistance) -
          this.combinedCost(b, fastestDuration, shortestDistance) ||
        a.risk.riskScore - b.risk.riskScore ||
        a.durationSeconds - b.durationSeconds ||
        a.distanceMeters - b.distanceMeters ||
        a.id.localeCompare(b.id),
    )[0];
    const fastest =
      routes.find(
        (route) =>
          route.durationSeconds === fastestDuration && route.distanceMeters === shortestDistance,
      ) ??
      routes.find((route) => route.durationSeconds === fastestDuration) ??
      routes[0];
    const reason = this.reasonFor(selected, fastest, routes);
    const baselineIncidentIds = new Set(fastest.risk.incidents.map((incident) => incident.id));
    const output = routes.map((route) => {
      const routeIncidentIds = new Set(route.risk.incidents.map((incident) => incident.id));
      const avoidedIncidentCount = [...baselineIncidentIds].filter(
        (incidentId) => !routeIncidentIds.has(incidentId),
      ).length;
      const risk = { ...route.risk, avoidedIncidentCount };
      return {
        ...route,
        risk,
        recommended: route.id === selected.id,
        recommendationReason: route.id === selected.id ? reason : null,
      };
    });

    return { routes: output, recommendedRouteId: selected.id };
  }

  private combinedCost(
    route: RoutePreviewRoute,
    fastestDuration: number,
    shortestDistance: number,
  ): number {
    const durationPenalty =
      Math.max(0, route.durationSeconds - fastestDuration) / Math.max(1, fastestDuration);
    const distancePenalty =
      Math.max(0, route.distanceMeters - shortestDistance) / Math.max(1, shortestDistance);
    const weightTotal = this.riskWeight + this.durationWeight + this.distanceWeight;
    return (
      (this.riskWeight * route.risk.riskScore +
        this.durationWeight * durationPenalty +
        this.distanceWeight * distancePenalty) /
      Math.max(0.000001, weightTotal)
    );
  }

  private reasonFor(
    selected: RoutePreviewRoute,
    fastest: RoutePreviewRoute,
    routes: RoutePreviewRoute[],
  ): RouteRecommendationReason {
    if (routes.every((route) => route.risk.affectingIncidentCount === 0)) {
      return 'FASTEST_AVAILABLE_ROUTE';
    }
    if (selected.risk.riskScore <= fastest.risk.riskScore - this.minimumRiskImprovement) {
      return 'LOWER_REPORTED_FLOOD_RISK';
    }
    if (selected.id === fastest.id) return 'FASTEST_AVAILABLE_ROUTE';
    return 'LOWEST_COMBINED_ROUTE_COST';
  }
}
