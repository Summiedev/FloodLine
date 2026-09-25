import { IncidentSeverity, OfficialWarningStatus } from '@prisma/client';
import type { OfficialWarningsRepository } from './official-warnings.repository';
import { OfficialWarningsService } from './official-warnings.service';
import type { OfficialWarningRecord, OfficialWarningUpsertInput } from './official-warning.types';

const warningId = '10000000-0000-4000-8000-000000000001';
const authority = 'authority-example';

function input(overrides: Partial<OfficialWarningUpsertInput> = {}): OfficialWarningUpsertInput {
  return {
    authority,
    externalId: 'warning-1',
    title: 'Flood advisory',
    description: 'Flooding is possible in the affected area.',
    severity: IncidentSeverity.HIGH,
    affectedGeometry: { type: 'Point', coordinates: [3.4, 6.4] },
    issuedAt: new Date('2026-09-25T08:10:00.000Z'),
    effectiveAt: new Date('2026-09-25T08:10:00.000Z'),
    expiresAt: new Date('2026-09-25T12:00:00.000Z'),
    sourceUrl: 'https://authority.example/warnings/1',
    ...overrides,
  };
}

function record(overrides: Partial<OfficialWarningRecord> = {}): OfficialWarningRecord {
  return {
    id: warningId,
    authority,
    externalId: 'warning-1',
    title: 'Flood advisory',
    description: 'Flooding is possible in the affected area.',
    severity: IncidentSeverity.HIGH,
    status: OfficialWarningStatus.ACTIVE,
    affectedGeometry: { type: 'Point', coordinates: [3.4, 6.4] },
    issuedAt: new Date('2026-09-25T08:10:00.000Z'),
    effectiveAt: new Date('2026-09-25T08:10:00.000Z'),
    expiresAt: new Date('2026-09-25T12:00:00.000Z'),
    sourceUrl: 'https://authority.example/warnings/1',
    createdAt: new Date('2026-09-25T08:10:00.000Z'),
    updatedAt: new Date('2026-09-25T08:10:00.000Z'),
    ...overrides,
  };
}

function createService(existing: OfficialWarningRecord | null = null) {
  type TransactionCallback = (value: unknown) => unknown;
  const transactionMock = jest.fn<unknown, [TransactionCallback]>();
  const prisma = { $transaction: transactionMock };
  const repositoryMock = {
    findByIdentity: jest.fn().mockResolvedValue(existing),
    upsertWithinTransaction: jest.fn(),
    findById: jest.fn(),
    findMany: jest.fn(),
    expireDue: jest.fn(),
  };
  const queueService = { enqueueSystemJob: jest.fn().mockResolvedValue(undefined) };
  const service = new OfficialWarningsService(
    prisma as never,
    repositoryMock as unknown as OfficialWarningsRepository,
    queueService as never,
    { error: jest.fn() } as never,
  );
  return { service, prisma, repositoryMock, queueService };
}

describe('OfficialWarningsService', () => {
  it('creates a warning and emits one created event', async () => {
    const harness = createService();
    const created = record();
    harness.repositoryMock.upsertWithinTransaction.mockResolvedValue({
      record: created,
      inserted: true,
    });
    harness.prisma.$transaction.mockImplementation((callback) => callback({}));

    const result = await harness.service.upsert(input());

    expect(result).toMatchObject({ created: true, materiallyChanged: true });
    expect(harness.queueService.enqueueSystemJob).toHaveBeenCalledWith(
      'official-warning.created',
      expect.objectContaining({ warningId }),
      expect.any(Object),
    );
  });

  it('is idempotent when the same provider identity has no material changes', async () => {
    const existing = record();
    const harness = createService(existing);
    harness.repositoryMock.upsertWithinTransaction.mockResolvedValue({
      record: existing,
      inserted: false,
    });
    harness.prisma.$transaction.mockImplementation((callback) => callback({}));

    const result = await harness.service.upsert(input());

    expect(result).toMatchObject({ created: false, materiallyChanged: false });
    expect(harness.queueService.enqueueSystemJob).not.toHaveBeenCalled();
  });

  it('emits a changed event for a material update', async () => {
    const existing = record();
    const harness = createService(existing);
    harness.repositoryMock.upsertWithinTransaction.mockResolvedValue({
      record: record({ title: 'Updated flood advisory', updatedAt: new Date() }),
      inserted: false,
    });
    harness.prisma.$transaction.mockImplementation((callback) => callback({}));

    const result = await harness.service.upsert(input({ title: 'Updated flood advisory' }));

    expect(result.materiallyChanged).toBe(true);
    expect(harness.queueService.enqueueSystemJob).toHaveBeenCalledWith(
      'official-warning.changed',
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('emits a cancellation event when an active warning is cancelled', async () => {
    const existing = record();
    const harness = createService(existing);
    harness.repositoryMock.upsertWithinTransaction.mockResolvedValue({
      record: record({ status: OfficialWarningStatus.CANCELLED, updatedAt: new Date() }),
      inserted: false,
    });
    harness.prisma.$transaction.mockImplementation((callback) => callback({}));

    await harness.service.upsert(input({ status: OfficialWarningStatus.CANCELLED }));

    expect(harness.queueService.enqueueSystemJob).toHaveBeenCalledWith(
      'official-warning.cancelled',
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('expires due warnings and emits expiration events', async () => {
    const harness = createService();
    harness.repositoryMock.expireDue.mockResolvedValue([
      {
        id: warningId,
        authority,
        externalId: 'warning-1',
        expiresAt: new Date('2026-09-25T12:00:00.000Z'),
        updatedAt: new Date('2026-09-25T12:01:00.000Z'),
      },
    ]);

    await expect(harness.service.expireDueWarnings()).resolves.toBe(1);
    expect(harness.queueService.enqueueSystemJob).toHaveBeenCalledWith(
      'official-warning.expired',
      expect.objectContaining({ warningId, authority }),
      expect.any(Object),
    );
  });

  it('rejects unsafe source URLs and invalid geometry coordinates', async () => {
    const harness = createService();
    await expect(
      harness.service.upsert(input({ sourceUrl: 'javascript:alert(1)' })),
    ).rejects.toThrow('sourceUrl must be an HTTP(S) URL');
    await expect(
      harness.service.upsert(input({ affectedGeometry: { type: 'Point', coordinates: [300, 6] } })),
    ).rejects.toThrow('affectedGeometry coordinates are invalid');
  });
});
