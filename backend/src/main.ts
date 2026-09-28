import 'reflect-metadata';
import { createHttpApplication } from './http-app';

async function bootstrap(): Promise<void> {
  const { app, configService, logger } = await createHttpApplication({ enableShutdownHooks: true });

  const host = configService.getOrThrow<string>('app.host');
  const port = configService.getOrThrow<number>('app.port');
  await app.listen(port, host);
  logger.log({ host, port }, 'Bootstrap');
}

void bootstrap();
