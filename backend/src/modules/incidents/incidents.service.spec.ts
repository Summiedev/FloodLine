import { NotFoundException } from '@nestjs/common';
import {
  IncidentConfidenceLabel,
  IncidentSeverity,
  IncidentSourceType,
  IncidentStatus,
  IncidentType,
} from '@prisma/client';
import { IncidentConfidencePolicy } from './incident-confidence.policy';
import { IncidentQueryDto } from './dto/incident-query.dto';
import { IncidentsService } from './incidents.service';

const incident = {
  id: '10000000-0000-4000-8000-000000000001',
  incidentType: IncidentType.SEVERE_FLOODING,
  severity: IncidentSeverity.SEVERE,
  status: IncidentStatus.ACTIVE,
  longitude: 3.4,
  latitude: 6.4,
  affectedGeometry: null,
  locationName: 'Test Road',
  description: 'Water near vehicle bonnet level',
  confidenceScore: 0.95,
  confidenceLabel: IncidentConfidenceLabel.HIGH,
  sourceType: IncidentSourceType.OFFICIAL,
  confirmationCount: 14,
  photoCount: 3,
  firstReportedAt: new Date('2026-01-01T00:00:00.000Z'),
  lastConfirmedAt: new Date('2026-01-01T00:10:00.000Z'),
  resolvedAt: null,
  expiresAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:10:00.000Z'),
  distanceMeters: null,
};

function createService(mediaService?: { getAvailableIncidentPhotos: jest.Mock }) {
  const incidentsRepository = {
    findMany: jest.fn().mockResolvedValue({ rows: [incident], total: 1 }),
    findById: jest.fn().mockResolvedValue(incident),
    create: jest.fn(),
    update: jest.fn(),
  };
  return {
    service: new IncidentsService(
      incidentsRepository as never,
      new IncidentConfidencePolicy(),
      mediaService as never,
    ),
    incidentsRepository,
  };
}

describe('IncidentsService', () => {
  it('builds a center-radius filter for a nearby query', async () => {
    const harness = createService();
    const query = Object.assign(new IncidentQueryDto(), {
      longitude: 3.4,
      latitude: 6.4,
      radiusMeters: 5_000,
    });

    await harness.service.list(query);

    expect(harness.incidentsRepository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        center: { longitude: 3.4, latitude: 6.4, radiusMeters: 5_000 },
      }),
    );
  });

  it('builds a bounding-box filter', async () => {
    const harness = createService();
    const query = Object.assign(new IncidentQueryDto(), {
      west: 3.2,
      south: 6.3,
      east: 3.6,
      north: 6.6,
    });

    await harness.service.list(query);

    expect(harness.incidentsRepository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        bbox: { west: 3.2, south: 6.3, east: 3.6, north: 6.6 },
      }),
    );
  });

  it('passes type, status, severity, and updated-since filters', async () => {
    const harness = createService();
    const updatedSince = '2026-01-01T00:00:00.000Z';
    const query = Object.assign(new IncidentQueryDto(), {
      incidentType: IncidentType.BLOCKED_ROAD,
      status: IncidentStatus.RESOLVED,
      severity: IncidentSeverity.HIGH,
      updatedSince,
    });

    await harness.service.list(query);

    expect(harness.incidentsRepository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        incidentType: IncidentType.BLOCKED_ROAD,
        status: IncidentStatus.RESOLVED,
        severity: IncidentSeverity.HIGH,
        updatedSince: new Date(updatedSince),
      }),
    );
  });

  it('rejects incomplete or overlapping geospatial filters', async () => {
    const harness = createService();

    await expect(
      harness.service.list(Object.assign(new IncidentQueryDto(), { west: 3.2 })),
    ).rejects.toThrow('must be provided together');
    await expect(
      harness.service.list(
        Object.assign(new IncidentQueryDto(), {
          west: 3.2,
          south: 6.3,
          east: 3.6,
          north: 6.6,
          longitude: 3.4,
          latitude: 6.4,
          radiusMeters: 5_000,
        }),
      ),
    ).rejects.toThrow('either a bounding box or a center-radius');
  });

  it('rejects invalid coordinates before persistence', async () => {
    const harness = createService();

    await expect(
      harness.service.createIncident({
        incidentType: IncidentType.SEVERE_FLOODING,
        severity: IncidentSeverity.SEVERE,
        location: { longitude: 181, latitude: 6.4 },
        locationName: 'Test Road',
        description: 'Water near vehicle bonnet level',
        sourceType: IncidentSourceType.COMMUNITY,
      }),
    ).rejects.toThrow('longitude must be between');
    expect(harness.incidentsRepository.create).not.toHaveBeenCalled();
  });

  it('returns a map-ready incident by UUID and reports missing incidents', async () => {
    const harness = createService();

    await expect(harness.service.findById(incident.id)).resolves.toMatchObject({
      id: incident.id,
      location: { longitude: 3.4, latitude: 6.4, srid: 4326 },
      confirmationCount: 14,
      photoCount: 3,
    });

    harness.incidentsRepository.findById.mockResolvedValue(null);
    await expect(harness.service.findById(incident.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('includes safe available report-photo summaries on incident detail', async () => {
    const mediaService = {
      getAvailableIncidentPhotos: jest.fn().mockResolvedValue([
        {
          id: '10000000-0000-4000-8000-000000000020',
          contentType: 'image/jpeg',
          byteSize: 2_048,
          width: 800,
          height: 600,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          accessUrl: 'signed://read-url',
        },
      ]),
    };
    const harness = createService(mediaService);

    await expect(harness.service.findById(incident.id)).resolves.toMatchObject({
      reportPhotos: {
        count: 1,
        items: [{ id: '10000000-0000-4000-8000-000000000020', accessUrl: 'signed://read-url' }],
      },
    });
  });

  it('derives confidence from source type instead of accepting a caller score', async () => {
    const harness = createService();
    harness.incidentsRepository.create.mockResolvedValue(incident);

    await harness.service.createIncident({
      incidentType: IncidentType.SEVERE_FLOODING,
      severity: IncidentSeverity.SEVERE,
      location: { longitude: 3.4, latitude: 6.4 },
      locationName: 'Test Road',
      description: 'Water near vehicle bonnet level',
      sourceType: IncidentSourceType.OFFICIAL,
    });

    expect(harness.incidentsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        confidence: { score: 0.95, label: IncidentConfidenceLabel.HIGH },
      }),
    );
  });
});
