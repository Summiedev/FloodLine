import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SavedPlacesController } from './saved-places.controller';
import { SavedPlacesRepository } from './saved-places.repository';
import { SavedPlacesService } from './saved-places.service';

@Module({
  imports: [AuthModule],
  controllers: [SavedPlacesController],
  providers: [SavedPlacesRepository, SavedPlacesService],
  exports: [SavedPlacesService],
})
export class SavedPlacesModule {}
