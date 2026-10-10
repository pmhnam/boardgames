import type { ApiError } from '@bgp/shared-types';

/** A request the server refused. Apart from `http.ts`, so reading one needs no browser. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly error: ApiError,
  ) {
    super(error.message);
    this.name = 'ApiRequestError';
  }

  get code(): string {
    return this.error.code;
  }
}
