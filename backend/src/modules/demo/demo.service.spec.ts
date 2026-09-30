import type { ConfigService } from '@nestjs/config';
import { DemoService } from './demo.service';
import { DEMO_HAZARD_ID } from './demo.constants';

describe('DemoService', () => {
  function createService(enabled = true) {
    const prisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const queue = { enqueueSystemJob: jest.fn().mockResolvedValue(undefined) };
    const redis = { getClient: () => ({ del: jest.fn().mockResolvedValue(1) }) };
    const logger = { log: jest.fn() };
    const config = { get: jest.fn().mockReturnValue(enabled) } as unknown as ConfigService;
    return {
      service: new DemoService(prisma as never, queue as never, redis as never, logger as never, config),
      prisma,
      queue,
    };
  }

  it('activates the fixed hazard and enqueues navigation and alert evaluation', async () => {
    const harness = createService();

    await expect(harness.service.triggerHazard('user-1')).resolves.toMatchObject({
      activated: true,
      incidentId: DEMO_HAZARD_ID,
    });
    expect(harness.prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(harness.queue.enqueueSystemJob).toHaveBeenCalledTimes(2);
  });

  it('does not expose demo controls when disabled', async () => {
    const harness = createService(false);

    await expect(harness.service.triggerHazard('user-1')).rejects.toThrow('Demo controls are not enabled');
    expect(harness.prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('reports when the controlled seed has not been run', async () => {
    const harness = createService();
    harness.prisma.$executeRaw.mockResolvedValue(0);

    await expect(harness.service.triggerHazard('user-1')).rejects.toThrow('Run the demo seed first');
    expect(harness.queue.enqueueSystemJob).not.toHaveBeenCalled();
  });
});
