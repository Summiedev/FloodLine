import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContributorAdminGuard } from './contributor-admin.guard';
import { ProfilesController } from './profiles.controller';
import { ContributorStatusService } from './contributor-status.service';
import { CONTRIBUTOR_TRUST_PROVIDER } from './contributor-status.types';

@Module({
  imports: [AuthModule],
  controllers: [ProfilesController],
  providers: [
    ContributorStatusService,
    ContributorAdminGuard,
    { provide: CONTRIBUTOR_TRUST_PROVIDER, useExisting: ContributorStatusService },
  ],
  exports: [ContributorStatusService, CONTRIBUTOR_TRUST_PROVIDER],
})
export class ProfilesModule {}
