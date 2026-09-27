import { Controller, Get, UseGuards, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { CommunityImpactService } from './community-impact.service';

@Controller({ path: 'me/community-impact', version: '1' })
@UseGuards(AccessTokenGuard)
@ApiBearerAuth()
@ApiTags('community-impact')
export class CommunityImpactController {
  constructor(private readonly service: CommunityImpactService) {}

  @Get()
  @Version('1')
  @ApiOperation({ summary: 'Get server-derived community-impact statistics' })
  get(@CurrentUser() user: AuthPrincipal) {
    return this.service.getForUser(user.userId);
  }
}
