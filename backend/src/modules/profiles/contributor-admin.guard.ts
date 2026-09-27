import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RequestWithAuthUser } from '../auth/auth.guard';

@Injectable()
export class ContributorAdminGuard implements CanActivate {
  private readonly adminUserIds: Set<string>;

  constructor(configService: ConfigService) {
    this.adminUserIds = new Set(
      configService
        .getOrThrow<string[]>('contributor.adminUserIds')
        .map((userId) => userId.toLowerCase()),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithAuthUser>();
    if (!this.adminUserIds.has(request.user?.userId.toLowerCase())) {
      throw new ForbiddenException('Contributor-status administration is restricted');
    }
    return true;
  }
}
