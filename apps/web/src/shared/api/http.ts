import { ErrorCodes, type ApiError, type ApiErrorBody } from '@bgp/shared-types';
import { useAuthStore } from '../../features/auth/auth.store';

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

/** JSON over REST. Throws ApiRequestError carrying the server's machine-readable code. */
export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = useAuthStore.getState().session?.accessToken;
  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.ok) return (await response.json()) as T;

  const fallback: ApiError = { code: ErrorCodes.Internal, message: response.statusText };
  const error = await response
    .json()
    .then((parsed: Partial<ApiErrorBody>) => parsed.error ?? fallback)
    .catch(() => fallback);
  // The token no longer maps to a user (expired, or the dev database was reset).
  if (response.status === 401) useAuthStore.getState().signOut();
  throw new ApiRequestError(response.status, error);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}
