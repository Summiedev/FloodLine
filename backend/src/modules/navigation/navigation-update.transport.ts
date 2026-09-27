import { Injectable } from '@nestjs/common';
import { StructuredLogger } from '../../common/logging/structured-logger.service';
import type { NavigationRouteUpdateEvent } from './navigation.types';

export interface NavigationUpdateTransport {
  publish(event: NavigationRouteUpdateEvent): Promise<void>;
}

/**
 * Development transport seam. Production can replace this binding with WebSocket/SSE delivery and
 * a push-notification fallback without changing navigation or rerouting business logic.
 */
@Injectable()
export class LocalNavigationUpdateTransport implements NavigationUpdateTransport {
  constructor(private readonly logger: StructuredLogger) {}

  publish(event: NavigationRouteUpdateEvent): Promise<void> {
    this.logger.log(
      {
        updateId: event.updateId,
        userId: event.userId,
        sessionId: event.sessionId,
        title: event.title,
        transport: 'local-log',
      },
      'NavigationUpdateTransport.publish',
    );
    return Promise.resolve();
  }
}
