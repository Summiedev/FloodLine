import { IncidentLifecycleService } from './incident-lifecycle.service';

const incidentId = '10000000-0000-4000-8000-000000000001';

function createService() {
  const executeRaw = jest.fn<Promise<number>, [unknown]>().mockResolvedValue(1);
  const values: Record<string, number> = {
    'incidentLifecycle.communityStaleAfterHours': 24,
    'incidentLifecycle.confirmationExtensionHours': 6,
  };
  const config = { getOrThrow: jest.fn((key: string) => values[key]) };
  return {
    service: new IncidentLifecycleService({ $executeRaw: executeRaw } as never, config as never),
    executeRaw,
  };
}

describe('IncidentLifecycleService', () => {
  it('refreshes the active window for a community report', async () => {
    const { service, executeRaw } = createService();

    await service.onReportSubmitted(incidentId);

    expect(executeRaw).toHaveBeenCalledTimes(1);
    const query = executeRaw.mock.calls[0]?.[0] as { sql?: string };
    expect(query.sql ?? '').toContain('GREATEST');
    expect(query.sql ?? '').toContain('COMMUNITY');
    expect(query.sql ?? '').toContain('ACTIVE');
  });

  it('extends active community incidents after confirmation', async () => {
    const { service, executeRaw } = createService();

    await service.onIncidentConfirmed(incidentId);

    expect(executeRaw).toHaveBeenCalledTimes(1);
    const query = executeRaw.mock.calls[0]?.[0] as { sql?: string };
    expect(query.sql ?? '').toContain("INTERVAL '1 hour'");
  });

  it('expires only due active incidents, making repeated sweeps safe', async () => {
    const { service, executeRaw } = createService();

    await expect(service.expireStaleIncidents()).resolves.toBe(1);

    const query = executeRaw.mock.calls[0]?.[0] as { sql?: string };
    expect(query.sql ?? '').toContain('SET status');
    expect(query.sql ?? '').toContain('EXPIRED');
    expect(query.sql ?? '').toContain('WHERE i.status');
    expect(query.sql ?? '').toContain('expires_at');
  });
});
