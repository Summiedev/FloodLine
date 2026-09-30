import { MapboxGeocodingProvider } from './mapbox-geocoding.provider';

const originalFetch = global.fetch;

function provider() {
  return new MapboxGeocodingProvider({
    get: jest.fn((key: string) =>
      key === 'geocoding.mapboxAccessToken'
        ? 'sk.test-token'
        : key === 'geocoding.mapboxCountry'
          ? 'ng'
          : key === 'geocoding.mapboxPermanent'
            ? true
            : undefined,
    ),
  } as never);
}

const feature = {
  id: 'mapbox-feature-id',
  geometry: { type: 'Point', coordinates: [3.45, 6.43] },
  properties: {
    mapbox_id: 'mapbox-place-id',
    name: 'Admiralty Way',
    place_formatted: 'Lekki Phase 1, Lagos, Nigeria',
    context: {
      country: { name: 'Nigeria', country_code: 'ng' },
      region: { name: 'Lagos' },
      place: { name: 'Lagos' },
    },
  },
};

describe('MapboxGeocodingProvider', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('normalizes a live search response without returning provider payloads', async () => {
    let requestedUrl = '';
    global.fetch = ((input) => {
      requestedUrl = requestUrl(input);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ features: [feature] }),
      });
    }) as typeof fetch;

    await expect(
      provider().search('Admiralty Way', {
        proximity: { longitude: 3.45, latitude: 6.43 },
      }),
    ).resolves.toEqual([
      {
        providerPlaceId: 'mapbox-place-id',
        name: 'Admiralty Way',
        formattedAddress: 'Lekki Phase 1, Lagos, Nigeria',
        coordinates: { longitude: 3.45, latitude: 6.43 },
        locality: { countryCode: 'NG', country: 'Nigeria', region: 'Lagos', city: 'Lagos' },
      },
    ]);
    expect(requestedUrl).toContain('country=ng');
    expect(requestedUrl).toContain('proximity=3.45%2C6.43');
    expect(requestedUrl).toContain('permanent=true');
    expect(requestedUrl).toContain('access_token=sk.test-token');
  });

  it('uses the documented reverse-geocoding coordinate order', async () => {
    let requestedUrl = '';
    global.fetch = ((input) => {
      requestedUrl = requestUrl(input);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ features: [feature] }),
      });
    }) as typeof fetch;

    await provider().reverseGeocode({ longitude: 3.45, latitude: 6.43 }, {});
    expect(requestedUrl).toContain('longitude=3.45');
    expect(requestedUrl).toContain('latitude=6.43');
  });
});

function requestUrl(input: RequestInfo | URL): string {
  if (input instanceof URL) return input.toString();
  return typeof input === 'string' ? input : input.url;
}
