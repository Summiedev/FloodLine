import { RouteRecommendationPolicy } from './route-recommendation.policy';
import { TravelMode } from './routing.types';
import type { RoutePreviewRoute } from './routing.types';

function createPolicy() {
  const config = {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, number> = {
        'routeRecommendation.riskWeight': 0.7,
        'routeRecommendation.durationWeight': 0.2,
        'routeRecommendation.distanceWeight': 0.1,
        'routeRecommendation.maximumDurationOverheadRatio': 0.5,
        'routeRecommendation.minimumRiskImprovement': 0.1,
      };
      return values[key];
    }),
  };
  return new RouteRecommendationPolicy(config as never);
}

function route(
  id: string,
  durationSeconds: number,
  riskScore: number,
  affectingIncidentCount: number,
  severeIncidentCount = 0,
): RoutePreviewRoute {
  return {
    id,
    routeId: id,
    geometry: {
      type: 'LineString',
      coordinates: [
        [3.4, 6.4],
        [3.5, 6.5],
      ],
    },
    polyline: null,
    distanceMeters: durationSeconds * 8,
    durationSeconds,
    travelMode: TravelMode.DRIVING,
    risk: {
      riskScore,
      riskLevel: riskScore >= 0.7 ? 'HIGH' : riskScore >= 0.3 ? 'MODERATE' : 'LOW',
      affectingIncidentCount,
      severeIncidentCount,
      avoidedIncidentCount: null,
      incidents: Array.from({ length: affectingIncidentCount }, (_, index) => ({
        id: `incident-${index + 1}`,
        incidentType: 'SEVERE_FLOODING',
        severity: severeIncidentCount > index ? 'SEVERE' : 'MODERATE',
        confidenceLabel: 'HIGH',
        sourceType: 'COMMUNITY',
        locationName: 'Test road',
        distanceMeters: 10,
        updatedAt: new Date('2026-09-27T10:00:00.000Z'),
      })),
      summary:
        affectingIncidentCount === 0 ? 'No currently known reports' : 'Flood reports detected',
    },
    recommended: false,
    recommendationReason: null,
  };
}

describe('RouteRecommendationPolicy', () => {
  it('selects a meaningfully lower-risk route when its duration is within policy', () => {
    const result = createPolicy().recommend([
      route('fast-risky', 1_500, 0.8, 3),
      route('slower-lower-risk', 1_860, 0.05, 0),
    ]);

    expect(result.recommendedRouteId).toBe('slower-lower-risk');
    expect(result.routes.find((item) => item.recommended)?.recommendationReason).toBe(
      'LOWER_REPORTED_FLOOD_RISK',
    );
    expect(
      result.routes.find((item) => item.id === 'slower-lower-risk')?.risk.avoidedIncidentCount,
    ).toBe(3);
  });

  it('chooses the faster route when equal-risk routes have no active incidents', () => {
    const result = createPolicy().recommend([
      route('fast', 1_000, 0, 0),
      route('slow', 1_200, 0, 0),
    ]);

    expect(result.recommendedRouteId).toBe('fast');
    expect(result.routes.find((item) => item.recommended)?.recommendationReason).toBe(
      'FASTEST_AVAILABLE_ROUTE',
    );
  });

  it('does not select a drastically longer lower-risk route without policy eligibility', () => {
    const result = createPolicy().recommend([
      route('fast-risky', 1_000, 0.8, 2),
      route('drastically-longer', 2_000, 0, 0),
    ]);

    expect(result.recommendedRouteId).toBe('fast-risky');
  });

  it('still selects the lower reported risk when all available routes are affected', () => {
    const result = createPolicy().recommend([
      route('severe-route', 1_000, 0.95, 3, 2),
      route('moderate-route', 1_100, 0.55, 2, 0),
    ]);

    expect(result.recommendedRouteId).toBe('moderate-route');
    expect(result.routes.find((item) => item.recommended)?.risk.severeIncidentCount).toBe(0);
  });

  it('handles a provider returning one route', () => {
    const result = createPolicy().recommend([route('only-route', 1_000, 0.9, 1, 1)]);

    expect(result.recommendedRouteId).toBe('only-route');
    expect(result.routes[0]).toMatchObject({
      recommended: true,
      recommendationReason: 'FASTEST_AVAILABLE_ROUTE',
    });
  });
});
