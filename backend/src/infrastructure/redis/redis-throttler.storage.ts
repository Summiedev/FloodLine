import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from './redis.service';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

const INCREMENT_SCRIPT = `
local blocked = redis.call('PTTL', KEYS[2])
if blocked > 0 then
  local current = tonumber(redis.call('GET', KEYS[1]) or '0')
  local expires = redis.call('PTTL', KEYS[1])
  return { current, expires, 1, blocked }
end
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local expires = redis.call('PTTL', KEYS[1])
if hits > tonumber(ARGV[2]) and tonumber(ARGV[3]) > 0 then
  redis.call('PSETEX', KEYS[2], ARGV[3], '1')
  return { hits, expires, 1, tonumber(ARGV[3]) }
end
return { hits, expires, 0, 0 }
`;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const baseKey = `throttle:${throttlerName}:${key}`;
    const result = await this.redis
      .getClient()
      .eval(INCREMENT_SCRIPT, 2, baseKey, `${baseKey}:blocked`, ttl, limit, blockDuration);
    if (!Array.isArray(result) || result.length < 4) {
      throw new Error('Redis throttler returned an invalid result');
    }
    const [totalHits, expiresMs, blocked, blockExpiresMs] = result.map(Number);
    return {
      totalHits,
      timeToExpire: Math.max(0, Math.ceil(expiresMs / 1_000)),
      isBlocked: blocked === 1,
      timeToBlockExpire: Math.max(0, Math.ceil(blockExpiresMs / 1_000)),
    };
  }
}
