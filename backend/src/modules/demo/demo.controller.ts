import { Controller, Post, UseGuards, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AccessTokenGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { DemoService } from './demo.service';

@Controller({ path: 'demo', version: '1' })
@UseGuards(AccessTokenGuard)
@ApiBearerAuth()
@ApiTags('demo')
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Post('trigger-hazard')
  @Version('1')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Activate the controlled demo hazard scenario' })
  triggerHazard(@CurrentUser() user: AuthPrincipal) {
    return this.demoService.triggerHazard(user.userId);
  }
}
