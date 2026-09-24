import { Module } from '@nestjs/common';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import { AuthModule } from '../auth/auth.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { FloodReportsController } from './flood-reports.controller';
import { IncidentAssociationService } from './incident-association.service';
import { FloodReportsRepository } from './flood-reports.repository';
import { FloodReportsService } from './flood-reports.service';

@Module({
  imports: [AuthModule, IncidentsModule],
  controllers: [FloodReportsController],
  providers: [
    StructuredLogger,
    FloodReportsRepository,
    IncidentAssociationService,
    FloodReportsService,
  ],
  exports: [FloodReportsService],
})
export class FloodReportsModule {}
