import { Injectable } from '@nestjs/common';
import type {
  GeocodingCoordinates,
  GeocodingPlace,
  GeocodingProvider,
  GeocodingSearchOptions,
} from './geocoding.types';

/**
 * Credential-free development adapter. It intentionally returns no provider data;
 * production deployments should bind a real provider behind GeocodingProvider.
 */
@Injectable()
export class LocalGeocodingProvider implements GeocodingProvider {
  readonly name = 'local';

  search(query: string, options: GeocodingSearchOptions): Promise<GeocodingPlace[]> {
    void query;
    void options;
    return Promise.resolve([]);
  }

  resolvePlace(
    providerPlaceId: string,
    options: GeocodingSearchOptions,
  ): Promise<GeocodingPlace | null> {
    void providerPlaceId;
    void options;
    return Promise.resolve(null);
  }

  reverseGeocode(
    coordinates: GeocodingCoordinates,
    options: GeocodingSearchOptions,
  ): Promise<GeocodingPlace | null> {
    void coordinates;
    void options;
    return Promise.resolve(null);
  }
}
