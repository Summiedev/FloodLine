import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { IncidentsController } from './incidents.controller';
import { IncidentConfidenceRepository } from './incident-confidence.repository';
import { IncidentConfidenceService } from './incident-confidence.service';
import { IncidentConfidencePolicy } from './incident-confidence.policy';
import { IncidentLifecycleService } from './incident-lifecycle.service';
import { IncidentsRepository } from './incidents.repository';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [MediaModule],
  controllers: [IncidentsController],
  providers: [
    IncidentsRepository,
    IncidentConfidenceRepository,
    IncidentConfidenceService,
    IncidentConfidencePolicy,
    IncidentLifecycleService,
    IncidentsService,
  ],
  exports: [IncidentsService, IncidentConfidenceService, IncidentLifecycleService],
})
export class IncidentsModule {}
