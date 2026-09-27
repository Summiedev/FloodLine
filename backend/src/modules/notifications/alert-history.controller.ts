import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { Throttle } from '@nestjs/throttler';
import { NOTIFICATION_RATE_LIMIT } from './notification.constants';
import { AlertHistoryService } from './alert-history.service';
import { AlertHistoryQueryDto } from './dto/alert-history-query.dto';

@Controller({ path: 'alerts', version: '1' })
@UseGuards(AccessTokenGuard)
@ApiBearerAuth()
@ApiTags('alerts')
@Throttle(NOTIFICATION_RATE_LIMIT)
export class AlertHistoryController {
  constructor(private readonly service: AlertHistoryService) {}

  @Get()
  @Version('1')
  @ApiOperation({ summary: 'List authenticated in-app alerts' })
  list(@CurrentUser() user: AuthPrincipal, @Query() query: AlertHistoryQueryDto) {
    return this.service.list(user.userId, query);
  }

  @Get(':id')
  @Version('1')
  @ApiOperation({ summary: 'Get an owned in-app alert' })
  findById(@CurrentUser() user: AuthPrincipal, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOwned(user.userId, id);
  }

  @Post(':id/read')
  @Version('1')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark an owned alert as read' })
  async markRead(
    @CurrentUser() user: AuthPrincipal,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.service.markRead(user.userId, id);
  }

  @Post('read-all')
  @Version('1')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all owned alerts as read' })
  markAllRead(@CurrentUser() user: AuthPrincipal): Promise<{ updatedCount: number }> {
    return this.service.markAllRead(user.userId);
  }
}
