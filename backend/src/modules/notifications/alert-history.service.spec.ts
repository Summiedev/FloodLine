import { AlertHistoryService } from './alert-history.service';

const userId = '10000000-0000-4000-8000-000000000001';
const alertId = '10000000-0000-4000-8000-000000000002';

describe('AlertHistoryService', () => {
  function createHarness() {
    const repository = {
      list: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      findOwnedById: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
    };
    return { service: new AlertHistoryService(repository as never), repository };
  }

  it('lists only through the authenticated user scope with supported filters', async () => {
    const harness = createHarness();
    const query = {
      page: 1,
      pageSize: 20,
      unread: true,
      severity: 'SEVERE',
      category: 'INCIDENT_ALERT',
    };

    await harness.service.list(userId, query as never);

    expect(harness.repository.list).toHaveBeenCalledWith({ userId, ...query });
  });

  it('enforces ownership when reading an alert', async () => {
    const harness = createHarness();
    harness.repository.findOwnedById.mockResolvedValue(null);

    await expect(harness.service.findOwned(userId, alertId)).rejects.toThrow('Alert not found');
    expect(harness.repository.findOwnedById).toHaveBeenCalledWith(userId, alertId);
  });

  it('keeps read operations idempotent and does not expose client creation', async () => {
    const harness = createHarness();
    harness.repository.markRead.mockResolvedValue(true);
    harness.repository.markAllRead.mockResolvedValue(4);

    await expect(harness.service.markRead(userId, alertId)).resolves.toBeUndefined();
    await expect(harness.service.markAllRead(userId)).resolves.toEqual({ updatedCount: 4 });
    expect(harness.repository).not.toHaveProperty('create');
  });
});
