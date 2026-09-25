import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { LocalStorageProvider } from './local-storage.provider';
import { MediaController } from './media.controller';
import { MediaRepository } from './media.repository';
import { MediaService } from './media.service';
import { STORAGE_PROVIDER } from './storage-provider';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [MediaController],
  providers: [
    LocalStorageProvider,
    MediaRepository,
    MediaService,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService, LocalStorageProvider],
      useFactory: (configService: ConfigService, localStorageProvider: LocalStorageProvider) => {
        const provider = configService.getOrThrow<string>('media.storageProvider');
        if (provider !== 'local') {
          throw new Error(
            `Storage provider "${provider}" is not configured; add an S3-compatible adapter before enabling it`,
          );
        }
        return localStorageProvider;
      },
    },
  ],
  exports: [MediaService, STORAGE_PROVIDER],
})
export class MediaModule {}
