export interface GeocodingCoordinates {
  longitude: number;
  latitude: number;
}

export interface GeocodingPlace {
  providerPlaceId: string;
  name: string;
  formattedAddress: string;
  coordinates: GeocodingCoordinates;
  locality?: {
    countryCode?: string;
    country?: string;
    region?: string;
    city?: string;
    district?: string;
  };
}

export interface GeocodingSearchOptions {
  signal?: AbortSignal;
  proximity?: GeocodingCoordinates;
}

export interface GeocodingProvider {
  readonly name: string;
  search(query: string, options: GeocodingSearchOptions): Promise<GeocodingPlace[]>;
  resolvePlace(
    providerPlaceId: string,
    options: GeocodingSearchOptions,
  ): Promise<GeocodingPlace | null>;
  reverseGeocode(
    coordinates: GeocodingCoordinates,
    options: GeocodingSearchOptions,
  ): Promise<GeocodingPlace | null>;
}

export const GEOCODING_PROVIDER = Symbol('GEOCODING_PROVIDER');
