import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CharacterId, TierKey } from '@/constants/cast';
import { CAMEO_LINES, type Speaker } from '@/constants/cameoLines';
import { fillLine, resolveCameo, type CameoBeat, type CameoTrigger, type CameoVars, type TriggerExtras } from '@/lib/cameoEngine';
import { useWorldStore } from '@/theme/useWorldStore';

export type CameoItem =
  | { kind: 'beat'; id: number; beat: CameoBeat; passThrough: boolean }
  | { kind: 'castUnlock'; id: number; tier: TierKey };

interface ShowOptions {
  /** In-workout: touches outside the bubble/portrait reach the logger */
  passThrough?: boolean;
  extras?: TriggerExtras;
}

interface CameoState {
  userId: string | null;
  enabled: boolean;
  /** Controls rest_dropin + home_dropin */
  dropins: boolean;
  recent: Speaker[];
  counts: Partial<Record<Speaker, number>>;
  lastHeavyGuest: CharacterId | null;
  queue: CameoItem[];
  /** Screens presented natively above the root (modals) mount their own host */
  localHosts: number;
  setLocalHost: (on: boolean) => void;

  hydrate: (userId: string | null) => Promise<void>;
  setEnabled: (v: boolean) => void;
  setDropins: (v: boolean) => void;
  /** Resolve and enqueue a trigger. Returns true if anything will show. */
  show: (trigger: CameoTrigger | 'rank_up', vars: CameoVars, opts?: ShowOptions) => boolean;
  /** Roster gallery: replay a random line from this character */
  replay: (speaker: Speaker, vars: CameoVars) => void;
  /** Home tab: ~20% chance, once per day, never on a rank-up day */
  maybeHomeDropin: (vars: CameoVars) => Promise<void>;
  /** Mark today as a rank-up day (suppresses home_dropin) */
  markRankUpDay: () => void;
  dismiss: () => void;
}

const DROPIN_TRIGGERS: (CameoTrigger | 'rank_up')[] = ['rest_dropin', 'home_dropin'];
const key = (uid: string, name: string) => `cameo_${name}_${uid}`;
const today = () => new Date().toISOString().slice(0, 10);
let seq = 0;

export const useCameoStore = create<CameoState>((set, get) => ({
  userId: null,
  enabled: true,
  dropins: true,
  recent: [],
  counts: {},
  lastHeavyGuest: null,
  queue: [],
  localHosts: 0,
  setLocalHost: on => set(st => ({ localHosts: Math.max(0, st.localHosts + (on ? 1 : -1)) })),

  hydrate: async userId => {
    set({ userId, queue: [] });
    if (!userId) return;
    try {
      const [enabled, dropins, recent, counts, heavy] = await Promise.all([
        AsyncStorage.getItem(key(userId, 'enabled')),
        AsyncStorage.getItem(key(userId, 'dropins')),
        AsyncStorage.getItem(key(userId, 'recent')),
        AsyncStorage.getItem(key(userId, 'counts')),
        AsyncStorage.getItem(key(userId, 'heavy')),
      ]);
      if (get().userId !== userId) return;
      set({
        enabled: enabled !== 'false',
        dropins: dropins !== 'false',
        recent: recent ? JSON.parse(recent) : [],
        counts: counts ? JSON.parse(counts) : {},
        lastHeavyGuest: (heavy as CharacterId) || null,
      });
    } catch {
      // defaults
    }
  },

  setEnabled: v => {
    set({ enabled: v, queue: v ? get().queue : [] });
    const uid = get().userId;
    if (uid) AsyncStorage.setItem(key(uid, 'enabled'), String(v)).catch(() => {});
  },
  setDropins: v => {
    set({ dropins: v });
    const uid = get().userId;
    if (uid) AsyncStorage.setItem(key(uid, 'dropins'), String(v)).catch(() => {});
  },

  show: (trigger, vars, opts = {}) => {
    const s = get();
    if (!s.enabled) return false;
    if (DROPIN_TRIGGERS.includes(trigger) && !s.dropins) return false;
    const world = useWorldStore.getState();
    const extras = { ...opts.extras, lastHeavyGuest: s.lastHeavyGuest };
    const beats = resolveCameo(trigger, vars, {
      currentTier: world.rankKey,
      highestTier: world.highestKey,
      recent: s.recent,
    }, extras);
    if (!beats.length) return false;

    const items: CameoItem[] = beats.map(beat => ({ kind: 'beat', id: ++seq, beat, passThrough: !!opts.passThrough }));
    if (trigger === 'rank_up') items.push({ kind: 'castUnlock', id: ++seq, tier: world.rankKey });

    const recent = [...s.recent, ...beats.map(b => b.speaker)].slice(-3);
    const counts = { ...s.counts };
    beats.forEach(b => { counts[b.speaker] = (counts[b.speaker] ?? 0) + 1; });
    const heavy = trigger === 'heavy_day' ? (beats[0].speaker as CharacterId) : s.lastHeavyGuest;
    set({ queue: [...s.queue, ...items], recent, counts, lastHeavyGuest: heavy });

    if (s.userId) {
      AsyncStorage.setItem(key(s.userId, 'recent'), JSON.stringify(recent)).catch(() => {});
      AsyncStorage.setItem(key(s.userId, 'counts'), JSON.stringify(counts)).catch(() => {});
      if (heavy) AsyncStorage.setItem(key(s.userId, 'heavy'), heavy).catch(() => {});
    }
    return true;
  },

  replay: (speaker, vars) => {
    const all = Object.entries(CAMEO_LINES)
      .flatMap(([trigger, bySpeaker]) => (bySpeaker?.[speaker] ?? []).map(l => ({ trigger: trigger as CameoTrigger, l })))
      .map(x => ({ ...x, text: fillLine(x.l, vars) }))
      .filter((x): x is { trigger: CameoTrigger; l: string; text: string } => x.text != null);
    if (!all.length) return;
    const pick = all[Math.floor(Math.random() * all.length)];
    set({
      queue: [...get().queue, {
        kind: 'beat', id: ++seq, passThrough: false,
        beat: { speaker, trigger: pick.trigger, text: pick.text, hype: false },
      }],
    });
  },

  maybeHomeDropin: async vars => {
    const { userId, enabled, dropins } = get();
    if (!userId || !enabled || !dropins) return;
    try {
      const [last, rankDay] = await Promise.all([
        AsyncStorage.getItem(key(userId, 'home_day')),
        AsyncStorage.getItem(key(userId, 'rankup_day')),
      ]);
      const d = today();
      if (last === d || rankDay === d) return;
      await AsyncStorage.setItem(key(userId, 'home_day'), d); // one roll per day
      if (Math.random() < 0.2) get().show('home_dropin', vars);
    } catch {
      // skip
    }
  },

  markRankUpDay: () => {
    const uid = get().userId;
    if (uid) AsyncStorage.setItem(key(uid, 'rankup_day'), today()).catch(() => {});
  },

  dismiss: () => set({ queue: get().queue.slice(1) }),
}));

export const showCameo = (trigger: CameoTrigger | 'rank_up', vars: CameoVars, opts?: ShowOptions) =>
  useCameoStore.getState().show(trigger, vars, opts);
