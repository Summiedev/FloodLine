import { IncidentSeverity, IncidentSourceType, IncidentType } from '@prisma/client';
import { IncidentAssociationService } from './incident-association.service';

const submission = {
  reporterUserId: '10000000-0000-4000-8000-000000000001',
  reportType: IncidentType.SEVERE_FLOODING,
  longitude: 3.4,
  latitude: 6.4,
  locationName: 'Test Road',
  description: 'Flood water is blocking the lane',
  observedSeverity: IncidentSeverity.SEVERE,
};

function createService() {
  const repository = {
    acquireAssociationLock: jest.fn(),
    findCompatibleIncident: jest.fn(),
    touchIncident: jest.fn(),
  };
  const incidentsService = {
    findByIdInTransaction: jest.fn(),
    createIncidentInTransaction: jest.fn(),
  };
  const configService = {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, number> = {
        'floodReport.associationRadiusMeters': 500,
        'floodReport.associationLookbackMinutes': 120,
      };
      return values[key];
    }),
  };

  return {
    service: new IncidentAssociationService(
      configService as never,
      repository as never,
      incidentsService as never,
    ),
    repository,
    incidentsService,
  };
}

describe('IncidentAssociationService', () => {
  it('creates a new community incident when no compatible incident exists', async () => {
    const harness = createService();
    const incident = { id: '10000000-0000-4000-8000-000000000010' };
    harness.repository.findCompatibleIncident.mockResolvedValue(null);
    harness.incidentsService.createIncidentInTransaction.mockResolvedValue(incident);

    await expect(harness.service.associateOrCreate({} as never, submission)).resolves.toBe(
      incident,
    );

    expect(harness.incidentsService.createIncidentInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        incidentType: IncidentType.SEVERE_FLOODING,
        sourceType: IncidentSourceType.COMMUNITY,
      }),
    );
  });

  it('associates with and touches a nearby compatible incident', async () => {
    const harness = createService();
    const transaction = {};
    const incidentId = '10000000-0000-4000-8000-000000000010';
    const incident = { id: incidentId };
    harness.repository.findCompatibleIncident.mockResolvedValue(incidentId);
    harness.incidentsService.findByIdInTransaction.mockResolvedValue(incident);

    await expect(harness.service.associateOrCreate(transaction as never, submission)).resolves.toBe(
      incident,
    );

    expect(harness.repository.touchIncident).toHaveBeenCalledWith(transaction, incidentId);
    expect(harness.incidentsService.createIncidentInTransaction).not.toHaveBeenCalled();
  });
});
