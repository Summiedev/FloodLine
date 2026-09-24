import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  appConfig,
  authConfig,
  databaseConfig,
  docsConfig,
  rateLimitConfig,
  redisConfig,
} from './config/configuration';
import { validateEnvironment } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { StructuredLogger } from './common/logging/structured-logger.service';
import { RequestIdMiddleware } from './common/request-context/request-id.middleware';
import { AlertPreferencesModule } from './modules/alert-preferences/alert_preferences.module';
import { AuthModule } from './modules/auth/auth.module';
import { CommunityImpactModule } from './modules/community-impact/community_impact.module';
import { FloodReportsModule } from './modules/flood-reports/flood_reports.module';
import { GeocodingModule } from './modules/geocoding/geocoding.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { MediaModule } from './modules/media/media.module';
import { NavigationModule } from './modules/navigation/navigation.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OfficialWarningsModule } from './modules/official-warnings/official_warnings.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { ReportConfirmationsModule } from './modules/report-confirmations/report_confirmations.module';
import { RoutingModule } from './modules/routing/routing.module';
import { SavedPlacesModule } from './modules/saved-places/saved_places.module';
import { UsersModule } from './modules/users/users.module';
import { JobsModule } from './modules/jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env'],
      load: [appConfig, authConfig, databaseConfig, docsConfig, rateLimitConfig, redisConfig],
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.getOrThrow<number>('rateLimit.ttlMs'),
          limit: configService.getOrThrow<number>('rateLimit.limit'),
        },
      ],
    }),
    DatabaseModule,
    RedisModule,
    QueueModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ProfilesModule,
    IncidentsModule,
    FloodReportsModule,
    ReportConfirmationsModule,
    OfficialWarningsModule,
    MediaModule,
    SavedPlacesModule,
    AlertPreferencesModule,
    NotificationsModule,
    RoutingModule,
    NavigationModule,
    GeocodingModule,
    CommunityImpactModule,
    IntegrationsModule,
    JobsModule,
  ],
  providers: [
    StructuredLogger,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
  ],
  exports: [StructuredLogger],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes({ path: '*path', method: RequestMethod.ALL });
  }
}
