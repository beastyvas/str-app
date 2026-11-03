import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TIER_KEYS, type TierKey } from '@/constants/cast';

/**
 * Which world is active. `rankKey` is written by useHomeData whenever it
 * computes a fresh rank (and cached to AsyncStorage so a cold launch opens
 * in the right world before the network answers). `highestKey` only ever
 * rises: every world you've reached stays unlocked. `override` is the
 * Profile → Appearance "Theme world" choice; null = match my rank.
 */
interface WorldState {
  userId: string | null;
  rankKey: TierKey;
  highestKey: TierKey;
  override: TierKey | null;
  hydrate: (userId: string | null) => Promise<void>;
  setRank: (key: TierKey) => void;
  setOverride: (key: TierKey | null) => void;
}

const k = (uid: string, name: string) => `world_${name}_${uid}`;
const isTier = (v: unknown): v is TierKey => typeof v === 'string' && (TIER_KEYS as string[]).includes(v);
export const tierIndex = (key: TierKey) => TIER_KEYS.indexOf(key);

export const useWorldStore = create<WorldState>((set, get) => ({
  userId: null,
  rankKey: 'mortal',
  highestKey: 'mortal',
  override: null,

  hydrate: async userId => {
    if (!userId) { set({ userId: null, rankKey: 'mortal', highestKey: 'mortal', override: null }); return; }
    set({ userId });
    try {
      const [rank, highest, override] = await Promise.all([
        AsyncStorage.getItem(k(userId, 'rank')),
        AsyncStorage.getItem(k(userId, 'highest')),
        AsyncStorage.getItem(k(userId, 'override')),
      ]);
      if (get().userId !== userId) return;
      set({
        rankKey: isTier(rank) ? rank : 'mortal',
        highestKey: isTier(highest) ? highest : isTier(rank) ? rank : 'mortal',
        override: isTier(override) ? override : null,
      });
    } catch {
      // storage unavailable — stay on defaults
    }
  },

  setRank: key => {
    const { userId, highestKey, rankKey } = get();
    const highest = tierIndex(key) > tierIndex(highestKey) ? key : highestKey;
    if (key === rankKey && highest === highestKey) return;
    set({ rankKey: key, highestKey: highest });
    if (userId) {
      AsyncStorage.setItem(k(userId, 'rank'), key).catch(() => {});
      AsyncStorage.setItem(k(userId, 'highest'), highest).catch(() => {});
    }
  },

  setOverride: key => {
    const { userId } = get();
    set({ override: key });
    if (userId) {
      if (key) AsyncStorage.setItem(k(userId, 'override'), key).catch(() => {});
      else AsyncStorage.removeItem(k(userId, 'override')).catch(() => {});
    }
  },
}));

/** Every world reached so far, lowest first. */
export function unlockedWorlds(highest: TierKey): TierKey[] {
  return TIER_KEYS.slice(0, tierIndex(highest) + 1);
}
