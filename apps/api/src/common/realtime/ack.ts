import type { Logger } from '@nestjs/common';
import type { Ack } from '@bgp/shared-types';
import { toApiError } from '../filters/app-exception.filter.js';

/** Runs a socket handler and answers with the envelope every client-to-server event gets. */
export async function toAck<T>(logger: Logger, handler: () => Promise<T> | T): Promise<Ack<T>> {
  try {
    return { ok: true, data: await handler() };
  } catch (error) {
    const { status, error: apiError } = toApiError(error);
    if (status >= 500) logger.error(error instanceof Error ? error.stack : error);
    return { ok: false, error: apiError };
  }
}
