import { Body, Controller, Get, Patch, Req, UseGuards, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import type { AuthPrincipal, RequestMeta } from '../auth/auth.types';
import { toPublicUser } from '../auth/public-user.mapper';
import { UpdateBasicProfileDto } from './dto/update-basic-profile.dto';
import { UsersService } from './users.service';

@Controller('me')
@UseGuards(AccessTokenGuard)
@ApiBearerAuth()
@ApiTags('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Version('1')
  getCurrentUser(@CurrentUser() user: AuthPrincipal) {
    return toPublicUser(user);
  }

  @Patch()
  @Version('1')
  updateBasicProfile(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: UpdateBasicProfileDto,
    @Req() request: Request,
  ) {
    return this.usersService.updateBasicProfile(user.userId, dto, requestMeta(request));
  }
}

function requestMeta(request: Request): RequestMeta {
  return {
    ipAddress: request.ip,
    userAgent: request.get('user-agent'),
  };
}
