import { DynamicModule, Module } from '@nestjs/common';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { OfficialWarningsModule } from '../official-warnings/official_warnings.module';
import { NavigationModule } from '../navigation/navigation.module';
import { SystemJobsProcessor } from './system-jobs.processor';
import { SystemJobsScheduler } from './system-jobs.scheduler';

@Module({})
export class JobsModule {
  /**
   * Vercel functions serve HTTP only. Queue consumers run in the separately
   * deployed worker process, selected with JOBS_PROCESSOR_ENABLED=true.
   */
  static forRoot(): DynamicModule {
    const processorEnabled = process.env.JOBS_PROCESSOR_ENABLED !== 'false';
    return {
      module: JobsModule,
      imports: [IncidentsModule, OfficialWarningsModule, NotificationsModule, NavigationModule],
      providers: processorEnabled
        ? [StructuredLogger, SystemJobsProcessor, SystemJobsScheduler]
        : [],
    };
  }
}
