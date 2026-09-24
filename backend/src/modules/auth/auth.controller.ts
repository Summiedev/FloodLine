import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AccessTokenGuard } from './auth.guard';
import { CurrentUser } from './auth.decorator';
import type { AuthPrincipal, RequestMeta } from './auth.types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';

const AUTH_RATE_LIMIT = { default: { limit: 10, ttl: 60_000 } };

@Controller({ path: 'auth', version: '1' })
@Throttle(AUTH_RATE_LIMIT)
@ApiTags('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.authService.register(dto, requestMeta(request));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, requestMeta(request));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refresh(dto, requestMeta(request));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  async logout(@CurrentUser() user: AuthPrincipal, @Req() request: Request): Promise<void> {
    await this.authService.logout(user.userId, user.sessionId, requestMeta(request));
  }
}

function requestMeta(request: Request): RequestMeta {
  return {
    ipAddress: request.ip,
    userAgent: request.get('user-agent'),
  };
}
