import { ErrorCodes, type ApiError, type ApiErrorBody } from '@bgp/shared-types';
import { useAuthStore } from '../../features/auth/auth.store';
import { ApiRequestError } from './api-request-error';
import { shouldSignOut } from './sign-out-policy';

export { ApiRequestError };

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
  if (shouldSignOut(error.code, token, useAuthStore.getState().session?.accessToken))
    useAuthStore.getState().signOut();
  throw new ApiRequestError(response.status, error);
}
