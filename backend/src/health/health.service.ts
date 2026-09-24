import { Injectable } from '@nestjs/common';
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
      this.checkDependency(() => this.prisma.$queryRaw`SELECT 1`),
      this.checkDependency(() => this.redis.ping()),
    ]);

    return {
      status: database.status === 'up' && redis.status === 'up' ? 'ready' : 'not_ready',
      checks: { database, redis },
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDependency(check: () => Promise<unknown>): Promise<ReadinessCheck> {
    const startedAt = Date.now();
    try {
      await check();
      return { status: 'up', latencyMs: Date.now() - startedAt };
    } catch {
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
        error: 'Dependency unavailable',
      };
    }
  }
}
