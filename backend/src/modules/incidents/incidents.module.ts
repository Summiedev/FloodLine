import { Module } from '@nestjs/common';
import { IncidentsController } from './incidents.controller';
import { IncidentConfidencePolicy } from './incident-confidence.policy';
import { IncidentsRepository } from './incidents.repository';
import { IncidentsService } from './incidents.service';

@Module({
  controllers: [IncidentsController],
  providers: [IncidentsRepository, IncidentConfidencePolicy, IncidentsService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
