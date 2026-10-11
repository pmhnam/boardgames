import { useRef, useState } from 'react';

/**
 * The same function for as long as the component lives, always calling the newest `handler`.
 * A memoised seat or card handed this is not drawn again just because its parent was.
 */
export function useStableHandler<Args extends unknown[], Result>(
  handler: (...args: Args) => Result,
): (...args: Args) => Result {
  const latest = useRef(handler);
  latest.current = handler;
  const [stable] = useState(
    () =>
      (...args: Args) =>
        latest.current(...args),
  );
  return stable;
}
