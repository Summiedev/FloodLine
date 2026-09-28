import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { LocalStorageProvider } from './local-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { MediaController } from './media.controller';
import { MediaRepository } from './media.repository';
import { MediaService } from './media.service';
import { STORAGE_PROVIDER } from './storage-provider';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [MediaController],
  providers: [
    LocalStorageProvider,
    S3StorageProvider,
    MediaRepository,
    MediaService,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService, LocalStorageProvider, S3StorageProvider],
      useFactory: (
        configService: ConfigService,
        localStorageProvider: LocalStorageProvider,
        s3StorageProvider: S3StorageProvider,
      ) => {
        const provider = configService.getOrThrow<string>('media.storageProvider');
        if (provider === 'local') return localStorageProvider;
        if (provider === 's3') {
          s3StorageProvider.assertConfigured();
          return s3StorageProvider;
        }
        throw new Error(`Unsupported media storage provider: ${provider}`);
      },
    },
  ],
  exports: [MediaService, STORAGE_PROVIDER],
})
export class MediaModule {}
