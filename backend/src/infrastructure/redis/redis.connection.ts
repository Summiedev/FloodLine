import type { RedisOptions } from 'ioredis';

export function redisConnectionFromUrl(redisUrl: string): RedisOptions {
  const parsedUrl = new URL(redisUrl);
  const database = parsedUrl.pathname.replace('/', '');

  return {
    host: parsedUrl.hostname,
    port: parsedUrl.port ? Number(parsedUrl.port) : 6379,
    ...(parsedUrl.username ? { username: decodeURIComponent(parsedUrl.username) } : {}),
    ...(parsedUrl.password ? { password: decodeURIComponent(parsedUrl.password) } : {}),
    ...(database ? { db: Number(database) } : {}),
    ...(parsedUrl.protocol === 'rediss:' ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}
