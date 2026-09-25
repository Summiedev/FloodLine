import { Module } from '@nestjs/common';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import { AuthModule } from '../auth/auth.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { IncidentConfirmationsController } from './incident-confirmations.controller';
import { IncidentConfirmationsRepository } from './incident-confirmations.repository';
import { IncidentConfirmationsService } from './incident-confirmations.service';

@Module({
  imports: [AuthModule, IncidentsModule],
  controllers: [IncidentConfirmationsController],
  providers: [StructuredLogger, IncidentConfirmationsRepository, IncidentConfirmationsService],
  exports: [IncidentConfirmationsService],
})
export class ReportConfirmationsModule {}
