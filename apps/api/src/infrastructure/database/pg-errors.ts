const UNIQUE_VIOLATION = '23505';

interface PgErrorLike {
  code?: unknown;
  constraint?: unknown;
  cause?: unknown;
}

function findPgError(error: unknown): PgErrorLike | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && typeof current === 'object' && current !== null; depth++) {
    const candidate = current as PgErrorLike;
    if (typeof candidate.code === 'string' && /^[0-9A-Z]{5}$/.test(candidate.code)) {
      return candidate;
    }
    current = candidate.cause;
  }
  return null;
}

/** Returns the violated constraint name, or null if `error` is not a unique violation. */
export function uniqueViolationConstraint(error: unknown): string | null {
  const pgError = findPgError(error);
  if (pgError?.code !== UNIQUE_VIOLATION) return null;
  return typeof pgError.constraint === 'string' ? pgError.constraint : '';
}
