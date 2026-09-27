import { Module } from '@nestjs/common';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { OfficialWarningsModule } from '../official-warnings/official_warnings.module';
import { NavigationModule } from '../navigation/navigation.module';
import { SystemJobsProcessor } from './system-jobs.processor';
import { SystemJobsScheduler } from './system-jobs.scheduler';

@Module({
  imports: [IncidentsModule, OfficialWarningsModule, NotificationsModule, NavigationModule],
  providers: [StructuredLogger, SystemJobsProcessor, SystemJobsScheduler],
})
export class JobsModule {}
