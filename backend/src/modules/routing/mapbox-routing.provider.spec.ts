import { MapboxRoutingProvider } from './mapbox-routing.provider';
import { TravelMode } from './routing.types';

const originalFetch = global.fetch;

function provider() {
  return new MapboxRoutingProvider({
    get: jest.fn((key: string) =>
      key === 'routing.mapboxAccessToken'
        ? 'sk.test-token'
        : key === 'routing.mapboxDrivingProfile'
          ? 'mapbox/driving-traffic'
          : undefined,
    ),
  } as never);
}

describe('MapboxRoutingProvider', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('requests alternatives and converts only safe normalized route fields', async () => {
    let requestedUrl = '';
    global.fetch = ((input) => {
      requestedUrl =
        input instanceof URL ? input.toString() : typeof input === 'string' ? input : input.url;
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            code: 'Ok',
            routes: [
              {
                distance: 12_000.5,
                duration: 1_860.1,
                geometry: {
                  type: 'LineString',
                  coordinates: [
                    [3.4, 6.4],
                    [3.5, 6.5],
                  ],
                },
              },
            ],
          }),
      });
    }) as typeof fetch;

    const routes = await provider().route({
      origin: { longitude: 3.4, latitude: 6.4 },
      destination: { longitude: 3.5, latitude: 6.5 },
      travelMode: TravelMode.DRIVING,
    });

    expect(requestedUrl).toContain('mapbox/driving-traffic/3.4,6.4;3.5,6.5');
    expect(requestedUrl).toContain('alternatives=true');
    expect(routes).toEqual([
      expect.objectContaining({
        distanceMeters: 12_000.5,
        durationSeconds: 1_860,
        travelMode: TravelMode.DRIVING,
        geometry: {
          type: 'LineString',
          coordinates: [
            [3.4, 6.4],
            [3.5, 6.5],
          ],
        },
      }),
    ]);
  });

  it('does not claim unsupported transit capability', () => {
    expect(provider().supportedTravelModes).not.toContain(TravelMode.TRANSIT);
  });
});
