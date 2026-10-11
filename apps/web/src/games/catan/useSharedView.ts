import { replaceEqualDeep } from '@tanstack/react-query';
import { useRef } from 'react';

/**
 * The server's view with every part that did not change kept as the very object it was. Each
 * state arrives parsed afresh, so without this nothing downstream can tell what moved: the
 * island's tiles and ports look as new as the one road that was just built.
 */
export function useSharedView<T>(view: T): T {
  const shared = useRef(view);
  shared.current = replaceEqualDeep(shared.current, view);
  return shared.current;
}
