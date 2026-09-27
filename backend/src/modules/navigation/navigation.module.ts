import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoutingModule } from '../routing/routing.module';
import { LocalNavigationUpdateTransport } from './navigation-update.transport';
import { NavigationController } from './navigation.controller';
import { NavigationRepository } from './navigation.repository';
import { NavigationService } from './navigation.service';
import { NAVIGATION_UPDATE_TRANSPORT } from './navigation.constants';

@Module({
  imports: [AuthModule, RoutingModule],
  controllers: [NavigationController],
  providers: [
    LocalNavigationUpdateTransport,
    NavigationRepository,
    NavigationService,
    {
      provide: NAVIGATION_UPDATE_TRANSPORT,
      useExisting: LocalNavigationUpdateTransport,
    },
  ],
  exports: [NavigationService],
})
export class NavigationModule {}
