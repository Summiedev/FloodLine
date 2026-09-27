import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { AlertPreferencesController } from './alert-preferences.controller';
import { AlertPreferencesRepository } from './alert-preferences.repository';
import { AlertPreferencesService } from './alert-preferences.service';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [AlertPreferencesController],
  providers: [AlertPreferencesRepository, AlertPreferencesService],
  exports: [AlertPreferencesService],
})
export class AlertPreferencesModule {}
