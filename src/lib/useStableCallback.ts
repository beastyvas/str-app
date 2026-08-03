import { useCallback, useRef } from 'react';

/**
 * Returns a function whose identity never changes but which always calls the
 * latest render's closure. Use for callbacks passed to React.memo children
 * from components that re-render often (avoids dependency-array churn).
 */
export function useStableCallback<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback(((...args: any[]) => ref.current(...args)) as T, []);
}
