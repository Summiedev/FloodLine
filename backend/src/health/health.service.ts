import { Injectable, Optional } from '@nestjs/common';
import { MetricsService } from '../common/metrics/metrics.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../infrastructure/redis/redis.service';

export interface ReadinessCheck {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

export interface ReadinessResult {
  status: 'ready' | 'not_ready';
  checks: {
    database: ReadinessCheck;
    redis: ReadinessCheck;
  };
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  liveness(): { status: 'ok'; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'floodline-api',
      timestamp: new Date().toISOString(),
    };
  }

  async readiness(): Promise<ReadinessResult> {
    const [database, redis] = await Promise.all([
      this.checkDependency('database', () => this.prisma.$queryRaw`SELECT 1`),
      this.checkDependency('redis', () => this.redis.ping()),
    ]);

    return {
      status: database.status === 'up' && redis.status === 'up' ? 'ready' : 'not_ready',
      checks: { database, redis },
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDependency(
    dependency: string,
    check: () => Promise<unknown>,
  ): Promise<ReadinessCheck> {
    const startedAt = Date.now();
    try {
      await check();
      const latencyMs = Date.now() - startedAt;
      this.metrics?.observe('dependency_latency_ms', latencyMs, { dependency });
      this.metrics?.setGauge('dependency_up', 1, { dependency });
      return { status: 'up', latencyMs };
    } catch {
      const latencyMs = Date.now() - startedAt;
      this.metrics?.observe('dependency_latency_ms', latencyMs, { dependency });
      this.metrics?.setGauge('dependency_up', 0, { dependency });
      return {
        status: 'down',
        latencyMs,
        error: 'Dependency unavailable',
      };
    }
  }
}
