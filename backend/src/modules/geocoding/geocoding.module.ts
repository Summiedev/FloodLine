import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalGeocodingProvider } from './local-geocoding.provider';
import { GeocodingController } from './geocoding.controller';
import { GeocodingService } from './geocoding.service';
import { GEOCODING_PROVIDER } from './geocoding.types';

@Module({
  controllers: [GeocodingController],
  providers: [
    LocalGeocodingProvider,
    GeocodingService,
    {
      provide: GEOCODING_PROVIDER,
      inject: [ConfigService, LocalGeocodingProvider],
      useFactory: (configService: ConfigService, localProvider: LocalGeocodingProvider) => {
        const provider = configService.getOrThrow<string>('geocoding.provider');
        if (provider === 'local') return localProvider;
        throw new Error(`Unsupported geocoding provider: ${provider}`);
      },
    },
  ],
  exports: [GeocodingService, GEOCODING_PROVIDER],
})
export class GeocodingModule {}
