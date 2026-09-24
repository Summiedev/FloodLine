import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import type { AuthPrincipal } from './auth.types';

export interface RequestWithAuthUser extends Request {
  user: AuthPrincipal;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuthUser>();
    const authorization = request.header('authorization');
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : undefined;

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    request.user = await this.authService.validateAccessToken(token);
    return true;
  }
}
