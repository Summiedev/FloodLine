import { Module } from '@nestjs/common';
import { MapIncidentsController } from './map-incidents.controller';
import { MapIncidentsRepository } from './map-incidents.repository';
import { MapIncidentsService } from './map-incidents.service';

@Module({
  controllers: [MapIncidentsController],
  providers: [MapIncidentsRepository, MapIncidentsService],
})
export class MapModule {}
