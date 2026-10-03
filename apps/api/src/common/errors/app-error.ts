import type { ApiError, ErrorCode } from '@bgp/shared-types';

/**
 * An expected, client-facing failure. Carries a stable machine-readable code; the HTTP filter
 * and the WebSocket gateway both render it from here.
 */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly httpStatus = 400,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toApiError(): ApiError {
    return {
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}
