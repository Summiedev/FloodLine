import { ContributorStatus } from '@prisma/client';
import { ContributorStatusService } from './contributor-status.service';

const adminId = '10000000-0000-4000-8000-000000000001';
const userId = '10000000-0000-4000-8000-000000000002';

function createHarness() {
  const transaction = {
    user: { findUnique: jest.fn().mockResolvedValue({ id: userId }) },
    userContributorStatus: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({
        userId,
        status: ContributorStatus.VERIFIED,
        assignedAt: new Date('2026-09-27T10:00:00.000Z'),
        assignedBy: adminId,
        reason: 'Reviewed contributor',
      }),
    },
    contributorStatusAudit: { create: jest.fn() },
  };
  const prisma = {
    userContributorStatus: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(transaction)),
  };
  const config = { getOrThrow: jest.fn().mockReturnValue([adminId]) };
  return {
    service: new ContributorStatusService(prisma as never, config as never),
    prisma,
    transaction,
  };
}

describe('ContributorStatusService', () => {
  it('defaults a user without an explicit record to STANDARD', async () => {
    const harness = createHarness();

    await expect(harness.service.getForUser(userId)).resolves.toEqual({
      status: ContributorStatus.STANDARD,
    });
  });

  it('prevents ordinary users and self-assignment from changing contributor status', async () => {
    const harness = createHarness();

    await expect(
      harness.service.assignStatus(userId, userId, { status: ContributorStatus.VERIFIED }),
    ).rejects.toThrow('administration is restricted');
    await expect(
      harness.service.assignStatus('10000000-0000-4000-8000-000000000003', userId, {
        status: ContributorStatus.VERIFIED,
      }),
    ).rejects.toThrow('administration is restricted');
    expect(harness.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows an authorized administrator to assign status and writes an audit entry', async () => {
    const harness = createHarness();

    await expect(
      harness.service.assignStatus(adminId, userId, {
        status: ContributorStatus.VERIFIED,
        reason: 'Reviewed contributor',
      }),
    ).resolves.toMatchObject({ userId, status: ContributorStatus.VERIFIED, assignedBy: adminId });
    expect(harness.transaction.contributorStatusAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId,
        newStatus: ContributorStatus.VERIFIED,
        assignedBy: adminId,
      }),
    });
  });

  it('exposes contributor status as a trust-provider interface for confidence scoring', async () => {
    const harness = createHarness();
    const database = { $queryRaw: jest.fn().mockResolvedValue([{ trustedWeight: 0.5 }]) };

    await expect(
      harness.service.getIncidentTrustedContributorWeight(
        database,
        '10000000-0000-4000-8000-000000000004',
      ),
    ).resolves.toBe(0.5);
    expect(database.$queryRaw).toHaveBeenCalled();
  });
});
