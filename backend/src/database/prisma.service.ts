import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(configService: ConfigService) {
    const databaseUrl = new URL(configService.getOrThrow<string>('database.url'));
    const connectionLimit = configService.getOrThrow<number>('database.connectionLimit');
    const transactionMaxWaitMs = configService.getOrThrow<number>('database.transactionMaxWaitMs');
    const transactionTimeoutMs = configService.getOrThrow<number>('database.transactionTimeoutMs');

    // Supabase transaction pooling (6543) does not preserve prepared
    // statements between transactions. Prisma must disable them when the
    // application uses that pooler; session/direct connections do not need it.
    if (databaseUrl.port === '6543') {
      databaseUrl.searchParams.set('pgbouncer', 'true');
      databaseUrl.searchParams.set('connection_limit', String(connectionLimit));
    }

    super({
      datasources: {
        db: {
          url: databaseUrl.toString(),
        },
      },
      transactionOptions: {
        maxWait: transactionMaxWaitMs,
        timeout: transactionTimeoutMs,
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
