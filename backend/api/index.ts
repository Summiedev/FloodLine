import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHttpApplication } from '../src/http-app';

type ExpressHandler = (request: IncomingMessage, response: ServerResponse) => void;

let handlerPromise: Promise<ExpressHandler> | undefined;

function getHandler(): Promise<ExpressHandler> {
  handlerPromise ??= createHttpApplication().then(async ({ app }) => {
    await app.init();
    return app.getHttpAdapter().getInstance() as ExpressHandler;
  });

  return handlerPromise;
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const expressHandler = await getHandler();
  expressHandler(request, response);
}
