import { Module } from '@nestjs/common';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import { IncidentsModule } from '../incidents/incidents.module';
import { OfficialWarningsModule } from '../official-warnings/official_warnings.module';
import { SystemJobsProcessor } from './system-jobs.processor';
import { SystemJobsScheduler } from './system-jobs.scheduler';

@Module({
  imports: [IncidentsModule, OfficialWarningsModule],
  providers: [StructuredLogger, SystemJobsProcessor, SystemJobsScheduler],
})
export class JobsModule {}
