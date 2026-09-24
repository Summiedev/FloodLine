import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from './queue.constants';
import { QueueService } from './queue.service';
import { redisConnectionFromUrl } from '../redis/redis.connection';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: redisConnectionFromUrl(configService.getOrThrow<string>('redis.url')),
        prefix: configService.getOrThrow<string>('redis.prefix'),
      }),
    }),
    BullModule.registerQueue({ name: QUEUE_NAMES.System }),
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
