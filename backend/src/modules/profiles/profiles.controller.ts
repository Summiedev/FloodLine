import { Body, Controller, Param, ParseUUIDPipe, Patch, UseGuards, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { ContributorAdminGuard } from './contributor-admin.guard';
import { UpdateContributorStatusDto } from './dto/update-contributor-status.dto';
import { ContributorStatusService } from './contributor-status.service';

@Controller({ path: 'admin/users', version: '1' })
@UseGuards(AccessTokenGuard, ContributorAdminGuard)
@ApiBearerAuth()
@ApiTags('profiles')
export class ProfilesController {
  constructor(private readonly service: ContributorStatusService) {}

  @Patch(':userId/contributor-status')
  @Version('1')
  @ApiOperation({ summary: 'Change a user contributor status (administrative)' })
  assignStatus(
    @CurrentUser() actor: AuthPrincipal,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateContributorStatusDto,
  ) {
    return this.service.assignStatus(actor.userId, userId, dto);
  }
}
