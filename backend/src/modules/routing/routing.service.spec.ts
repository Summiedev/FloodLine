import { HttpStatus } from '@nestjs/common';
import { ApplicationError } from '../../common/errors/application.error';
import { RoutingService } from './routing.service';
import { TravelMode } from './routing.types';
import type { RouteCandidate } from './routing.types';

const request = {
  origin: { longitude: 3.4, latitude: 6.4 },
  destination: { longitude: 3.5, latitude: 6.5 },
  travelMode: TravelMode.DRIVING,
};

const candidate: RouteCandidate = {
  providerRouteId: 'provider-route-1',
  fingerprint: 'internal-fingerprint-1',
  geometry: {
    type: 'LineString',
    coordinates: [
      [3.4, 6.4],
      [3.5, 6.5],
    ],
  },
  polyline: null,
  distanceMeters: 12_000,
  durationSeconds: 1_860,
  travelMode: TravelMode.DRIVING,
  providerMetadata: { vendor: 'must-not-leak' },
};

function createHarness() {
  const provider = {
    name: 'fake-provider',
    supportedTravelModes: Object.values(TravelMode),
    route: jest.fn().mockResolvedValue([candidate]),
  };
  const risk = {
    evaluate: jest.fn().mockResolvedValue({
      riskScore: 0,
      riskLevel: 'LOW',
      affectingIncidentCount: 0,
      severeIncidentCount: 0,
      avoidedIncidentCount: null,
      incidents: [],
      summary: 'No currently known reports',
    }),
  };
  const redisClient = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  };
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const config = {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, number> = {
        'routing.timeoutMs': 100,
        'routing.cacheTtlSeconds': 60,
      };
      return values[key];
    }),
  };
  const service = new RoutingService(
    provider,
    risk as never,
    { recommend: (routes: unknown) => ({ routes, recommendedRouteId: null }) } as never,
    { getClient: () => redisClient } as never,
    logger as never,
    config as never,
  );
  return { service, provider, risk, redisClient };
}

describe('RoutingService', () => {
  it('normalizes provider routes, evaluates risk, and does not expose provider metadata', async () => {
    const harness = createHarness();

    const response = await harness.service.preview(request);
    expect(response).toEqual({
      recommendedRouteId: null,
      routes: [
        expect.objectContaining({
          routeId: 'internal-fingerprint-1',
          distanceMeters: 12_000,
          durationSeconds: 1_860,
          risk: expect.objectContaining({ riskLevel: 'LOW' }),
        }),
      ],
    });
    expect(harness.risk.evaluate).toHaveBeenCalledWith(candidate.geometry);
    expect(harness.provider.route).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(response)).not.toContain('must-not-leak');
  });

  it('returns cached normalized results without calling the provider', async () => {
    const harness = createHarness();
    harness.redisClient.get.mockResolvedValue(JSON.stringify({ routes: [{ routeId: 'cached' }] }));

    await expect(harness.service.preview(request)).resolves.toEqual({
      routes: [{ routeId: 'cached' }],
    });
    expect(harness.provider.route).not.toHaveBeenCalled();
  });

  it('maps provider failures to a stable dependency error', async () => {
    const harness = createHarness();
    harness.provider.route.mockRejectedValue(new Error('vendor secret and response body'));

    await expect(harness.service.preview(request)).rejects.toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      status: HttpStatus.SERVICE_UNAVAILABLE,
      message: 'Routing provider is temporarily unavailable',
    });
  });

  it('aborts and maps a provider timeout to a gateway-timeout dependency error', async () => {
    const harness = createHarness();
    harness.provider.route.mockImplementation(() => new Promise<RouteCandidate[]>(() => undefined));

    await expect(harness.service.preview(request)).rejects.toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      status: HttpStatus.GATEWAY_TIMEOUT,
      message: 'Routing provider timed out',
    });
  });

  it('rejects invalid coordinates before invoking a provider', async () => {
    const harness = createHarness();

    await expect(
      harness.service.preview({
        ...request,
        origin: { longitude: 181, latitude: 6.4 },
      }),
    ).rejects.toBeInstanceOf(ApplicationError);
    expect(harness.provider.route).not.toHaveBeenCalled();
  });
});
