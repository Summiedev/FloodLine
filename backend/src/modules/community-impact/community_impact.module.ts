import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommunityImpactController } from './community-impact.controller';
import { CommunityImpactRepository } from './community-impact.repository';
import { CommunityImpactService } from './community-impact.service';

@Module({
  imports: [AuthModule],
  controllers: [CommunityImpactController],
  providers: [CommunityImpactRepository, CommunityImpactService],
  exports: [CommunityImpactService],
})
export class CommunityImpactModule {}
