import { createContext, ReactNode, useContext, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { WORLDS, type WorldTheme } from './worlds';
import { tierIndex, useWorldStore } from './useWorldStore';

const WorldContext = createContext<WorldTheme>(WORLDS.mortal);

/** Wraps the app (inside AuthProvider) and hydrates the active world per user. */
export function WorldProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const hydrate = useWorldStore(s => s.hydrate);
  const rankKey = useWorldStore(s => s.rankKey);
  const highestKey = useWorldStore(s => s.highestKey);
  const override = useWorldStore(s => s.override);

  useEffect(() => { hydrate(user?.id ?? null); }, [user?.id]);

  // An override only applies to a world you've actually unlocked.
  const key = override && tierIndex(override) <= tierIndex(highestKey) ? override : rankKey;
  const world = useMemo(() => WORLDS[key], [key]);

  return <WorldContext.Provider value={world}>{children}</WorldContext.Provider>;
}

/** The active world: theme colors, motif, SFX, readout, rank-up scene, cast. */
export function useWorld(): WorldTheme {
  return useContext(WorldContext);
}

/** Render a subtree in a specific world (dev preview, a friend's profile). */
export function WorldScope({ world, children }: { world: WorldTheme; children: ReactNode }) {
  return <WorldContext.Provider value={world}>{children}</WorldContext.Provider>;
}
