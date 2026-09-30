import type { ApplicationError } from '../../common/errors/application.error';
import { GeocodingService } from './geocoding.service';

const place = {
  providerPlaceId: 'place-1',
  name: 'Admiralty Way',
  formattedAddress: 'Admiralty Way, Lekki Phase 1',
  coordinates: { longitude: 3.45, latitude: 6.43 },
  locality: { city: 'Lagos', countryCode: 'NG' },
};

function createHarness() {
  const provider = {
    name: 'fake',
    search: jest.fn().mockResolvedValue([place]),
    resolvePlace: jest.fn().mockResolvedValue(place),
    reverseGeocode: jest.fn().mockResolvedValue(place),
  };
  const redisClient = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  };
  const redis = { getClient: jest.fn().mockReturnValue(redisClient) };
  const logger = { warn: jest.fn(), error: jest.fn() };
  const config = {
    getOrThrow: jest.fn((key: string) =>
      key === 'geocoding.timeoutMs' ? 100 : key === 'geocoding.cacheTtlSeconds' ? 300 : undefined,
    ),
  };
  return {
    service: new GeocodingService(provider, redis as never, logger as never, config as never),
    provider,
    redisClient,
  };
}

describe('GeocodingService', () => {
  it('normalizes provider search results and caches common queries', async () => {
    const harness = createHarness();

    await expect(harness.service.search('  Admiralty   Way ')).resolves.toEqual([place]);
    expect(harness.provider.search).toHaveBeenCalledWith('Admiralty Way', expect.anything());
    const cacheCall = harness.redisClient.set.mock.calls[0] as unknown[];
    expect(cacheCall[0]).toEqual(expect.stringContaining('geocoding:v1:fake:search:'));
    expect(JSON.parse(cacheCall[1] as string)).toEqual([place]);
    expect(cacheCall.slice(2)).toEqual(['EX', 300]);

    harness.redisClient.get.mockResolvedValueOnce(JSON.stringify([place]));
    await harness.service.search('Admiralty Way');
    expect(harness.provider.search).toHaveBeenCalledTimes(1);
  });

  it('supports resolving provider IDs and reverse geocoding with WGS84 coordinates', async () => {
    const harness = createHarness();

    await expect(harness.service.resolvePlace('place-1')).resolves.toEqual(place);
    await expect(
      harness.service.reverseGeocode({ longitude: 3.45, latitude: 6.43 }),
    ).resolves.toEqual(place);
    expect(harness.provider.reverseGeocode).toHaveBeenCalledWith(
      { longitude: 3.45, latitude: 6.43 },
      expect.anything(),
    );
  });

  it('keeps nearby-search cache entries separate by proximity', async () => {
    const harness = createHarness();
    const first = { longitude: 3.45, latitude: 6.43 };
    const second = { longitude: 3.55, latitude: 6.53 };

    await harness.service.search('road', first);
    await harness.service.search('road', second);

    expect(harness.provider.search).toHaveBeenNthCalledWith(
      1,
      'road',
      expect.objectContaining({ proximity: first }),
    );
    expect(harness.provider.search).toHaveBeenNthCalledWith(
      2,
      'road',
      expect.objectContaining({ proximity: second }),
    );
    const cacheCalls = harness.redisClient.set.mock.calls as Array<[string, ...unknown[]]>;
    expect(cacheCalls[0]?.[0]).not.toBe(cacheCalls[1]?.[0]);
  });

  it('rejects invalid coordinates and short queries before calling the provider', async () => {
    const harness = createHarness();

    await expect(harness.service.search('x')).rejects.toThrow('between 2 and 200');
    await expect(
      harness.service.reverseGeocode({ longitude: 181, latitude: 6.43 }),
    ).rejects.toThrow('coordinates are invalid');
    expect(harness.provider.search).not.toHaveBeenCalled();
    expect(harness.provider.reverseGeocode).not.toHaveBeenCalled();
  });

  it('maps provider failures to a stable dependency error', async () => {
    const harness = createHarness();
    harness.provider.search.mockRejectedValue(new Error('vendor response body'));

    await expect(harness.service.search('flood road')).rejects.toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      status: 503,
    } satisfies Partial<ApplicationError>);
  });

  it('does not expose a missing provider location as an internal error', async () => {
    const harness = createHarness();
    harness.provider.resolvePlace.mockResolvedValue(null);

    await expect(harness.service.resolvePlace('missing')).rejects.toThrow('Location was not found');
  });
});
