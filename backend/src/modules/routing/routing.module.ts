import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { LocalRoutingProvider } from './local-routing.provider';
import { RouteRiskRepository } from './route-risk.repository';
import { RouteRiskService } from './route-risk.service';
import { RouteRecommendationPolicy } from './route-recommendation.policy';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { ROUTING_PROVIDER } from './routing.types';

@Module({
  imports: [RedisModule],
  controllers: [RoutingController],
  providers: [
    LocalRoutingProvider,
    RouteRiskRepository,
    RouteRiskService,
    RouteRecommendationPolicy,
    RoutingService,
    {
      provide: ROUTING_PROVIDER,
      inject: [ConfigService, LocalRoutingProvider],
      useFactory: (configService: ConfigService, localProvider: LocalRoutingProvider) => {
        const provider = configService.getOrThrow<string>('routing.provider');
        if (provider === 'local') return localProvider;
        throw new Error(`Unsupported routing provider: ${provider}`);
      },
    },
  ],
  exports: [RouteRiskService, RoutingService],
})
export class RoutingModule {}
