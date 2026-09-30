import { Controller, Get, Param, Query, Version } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LocationSearchDto } from './dto/location-search.dto';
import { ReverseLocationDto } from './dto/reverse-location.dto';
import { LOCATION_RATE_LIMIT } from './geocoding.constants';
import { GeocodingService } from './geocoding.service';

@Controller({ path: 'locations', version: '1' })
@ApiTags('locations')
@Throttle(LOCATION_RATE_LIMIT)
export class GeocodingController {
  constructor(private readonly service: GeocodingService) {}

  @Get('search')
  @Version('1')
  @ApiOperation({ summary: 'Search normalized locations' })
  search(@Query() query: LocationSearchDto) {
    return this.service.search(
      query.q,
      query.lat !== undefined && query.lng !== undefined
        ? { latitude: query.lat, longitude: query.lng }
        : undefined,
    );
  }

  @Get('reverse')
  @Version('1')
  @ApiOperation({ summary: 'Reverse geocode WGS84 coordinates' })
  reverse(@Query() query: ReverseLocationDto) {
    return this.service.reverseGeocode({ longitude: query.lng, latitude: query.lat });
  }

  @Get(':providerPlaceId')
  @Version('1')
  @ApiOperation({ summary: 'Resolve a provider place ID to normalized location data' })
  resolve(@Param('providerPlaceId') providerPlaceId: string) {
    return this.service.resolvePlace(providerPlaceId);
  }
}
