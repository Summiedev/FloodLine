import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  GeocodingCoordinates,
  GeocodingPlace,
  GeocodingProvider,
  GeocodingSearchOptions,
} from './geocoding.types';

interface MapboxFeature {
  id?: unknown;
  text?: unknown;
  place_name?: unknown;
  center?: unknown;
  geometry?: { type?: unknown; coordinates?: unknown };
  properties?: {
    mapbox_id?: unknown;
    name?: unknown;
    place_formatted?: unknown;
    coordinates?: { longitude?: unknown; latitude?: unknown };
    context?: Record<string, { name?: unknown; country_code?: unknown }>;
  };
}

interface MapboxFeatureCollection {
  features?: unknown;
}

/** Server-side Mapbox Geocoding v6 adapter. */
@Injectable()
export class MapboxGeocodingProvider implements GeocodingProvider {
  readonly name = 'mapbox';
  private readonly accessToken?: string;
  private readonly country?: string;
  private readonly permanent: boolean;

  constructor(configService: ConfigService) {
    this.accessToken = configService.get<string>('geocoding.mapboxAccessToken');
    this.country = configService.get<string>('geocoding.mapboxCountry')?.toLowerCase();
    this.permanent = configService.get<boolean>('geocoding.mapboxPermanent') === true;
  }

  assertConfigured(): void {
    if (!this.accessToken) throw new Error('Mapbox geocoding is missing its access token');
  }

  async search(query: string, options: GeocodingSearchOptions): Promise<GeocodingPlace[]> {
    const url = new URL('https://api.mapbox.com/search/geocode/v6/forward');
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '10');
    if (this.country) url.searchParams.set('country', this.country);
    if (options.proximity) {
      url.searchParams.set(
        'proximity',
        `${options.proximity.longitude},${options.proximity.latitude}`,
      );
    }
    const features = await this.request(url, options.signal);
    return features.map((feature) => this.normalizeFeature(feature)).filter(isPlace);
  }

  resolvePlace(
    providerPlaceId: string,
    options: GeocodingSearchOptions,
  ): Promise<GeocodingPlace | null> {
    // Geocoding v6 returns stable IDs with search results but exposes no
    // ID-retrieval endpoint. Clients should retain the normalized result from
    // search; a generic provider with a retrieval API can support this route.
    void providerPlaceId;
    void options;
    return Promise.resolve(null);
  }

  async reverseGeocode(
    coordinates: GeocodingCoordinates,
    options: GeocodingSearchOptions,
  ): Promise<GeocodingPlace | null> {
    const url = new URL('https://api.mapbox.com/search/geocode/v6/reverse');
    url.searchParams.set('longitude', String(coordinates.longitude));
    url.searchParams.set('latitude', String(coordinates.latitude));
    if (this.country) url.searchParams.set('country', this.country);
    const [first] = await this.request(url, options.signal);
    return first ? this.normalizeFeature(first) : null;
  }

  private async request(url: URL, signal?: AbortSignal): Promise<MapboxFeature[]> {
    this.assertConfigured();
    url.searchParams.set('access_token', this.accessToken as string);
    if (this.permanent) url.searchParams.set('permanent', 'true');
    const response = await fetch(url, { signal, headers: { accept: 'application/json' } });
    if (!response.ok)
      throw new Error(`Mapbox Geocoding request failed with status ${response.status}`);
    const payload = (await response.json()) as MapboxFeatureCollection;
    if (!Array.isArray(payload.features) || payload.features.length > 10) {
      throw new Error('Mapbox Geocoding returned an invalid response');
    }
    return payload.features as MapboxFeature[];
  }

  private normalizeFeature(feature: MapboxFeature): GeocodingPlace | null {
    const properties = feature.properties;
    const coordinates = this.coordinates(feature);
    const providerPlaceId = stringValue(properties?.mapbox_id) ?? stringValue(feature.id);
    const name = stringValue(properties?.name) ?? stringValue(feature.text);
    const placeFormatted =
      stringValue(properties?.place_formatted) ?? stringValue(feature.place_name);
    if (!providerPlaceId || !name || !placeFormatted || !coordinates) return null;
    const context = properties?.context ?? {};
    const locality = {
      countryCode: stringValue(context.country?.country_code)?.toUpperCase(),
      country: stringValue(context.country?.name),
      region: stringValue(context.region?.name),
      city: stringValue(context.place?.name) ?? stringValue(context.locality?.name),
      district: stringValue(context.district?.name),
    };
    return {
      providerPlaceId,
      name,
      formattedAddress: placeFormatted,
      coordinates,
      ...(Object.values(locality).some(Boolean) ? { locality } : {}),
    };
  }

  private coordinates(feature: MapboxFeature): GeocodingCoordinates | null {
    const values = feature.properties?.coordinates;
    if (Number.isFinite(values?.longitude) && Number.isFinite(values?.latitude)) {
      return { longitude: Number(values?.longitude), latitude: Number(values?.latitude) };
    }
    const geometry = feature.geometry?.coordinates ?? feature.center;
    if (
      (feature.geometry && feature.geometry.type !== 'Point') ||
      !Array.isArray(geometry) ||
      !Number.isFinite(geometry[0]) ||
      !Number.isFinite(geometry[1])
    ) {
      return null;
    }
    return { longitude: Number(geometry[0]), latitude: Number(geometry[1]) };
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isPlace(value: GeocodingPlace | null): value is GeocodingPlace {
  return value !== null;
}
