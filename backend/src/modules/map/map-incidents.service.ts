import { Injectable } from '@nestjs/common';
import { ApplicationError } from '../../common/errors/application.error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { MapIncidentsRepository } from './map-incidents.repository';
import type { MapIncidentFeedResponse } from './map.types';
import type { MapIncidentsQueryDto } from './dto/map-incidents-query.dto';

@Injectable()
export class MapIncidentsService {
  constructor(private readonly repository: MapIncidentsRepository) {}

  async getFeed(query: MapIncidentsQueryDto): Promise<MapIncidentFeedResponse> {
    this.validateBounds(query);
    const updatedSince = query.updatedSince ? new Date(query.updatedSince) : undefined;
    const rows = await this.repository.findMarkers({
      north: query.north,
      south: query.south,
      east: query.east,
      west: query.west,
      ...(query.incidentTypes ? { incidentTypes: query.incidentTypes } : {}),
      ...(updatedSince ? { updatedSince } : {}),
      limit: query.limit,
    });
    const truncated = rows.length > query.limit;
    const visibleRows = truncated ? rows.slice(0, query.limit) : rows;
    const latest = visibleRows.reduce<Date | null>(
      (current, row) => (!current || row.updatedAt > current ? row.updatedAt : current),
      updatedSince ?? null,
    );
    return {
      data: visibleRows.map((row) => ({
        id: row.id,
        coordinates: { longitude: row.longitude, latitude: row.latitude, srid: 4326 },
        incidentType: row.incidentType as MapIncidentFeedResponse['data'][number]['incidentType'],
        severity: row.severity as MapIncidentFeedResponse['data'][number]['severity'],
        confidenceLabel:
          row.confidenceLabel as MapIncidentFeedResponse['data'][number]['confidenceLabel'],
        status: row.status as MapIncidentFeedResponse['data'][number]['status'],
        updatedAt: row.updatedAt,
        clustered: false,
        clusterId: null,
        pointCount: 1,
      })),
      meta: {
        count: visibleRows.length,
        limit: query.limit,
        truncated,
        datelineCrossing: query.west > query.east,
        updatedSince: query.updatedSince ?? null,
        nextUpdatedSince: (latest ?? new Date()).toISOString(),
        clustering: 'client-ready',
      },
    };
  }

  private validateBounds(query: MapIncidentsQueryDto): void {
    if (query.south >= query.north) {
      throw new ApplicationError(ErrorCodes.ValidationError, 'south must be less than north');
    }
    if (query.west === query.east) {
      throw new ApplicationError(
        ErrorCodes.ValidationError,
        'west and east cannot be equal; use a non-zero viewport width',
      );
    }
  }
}
