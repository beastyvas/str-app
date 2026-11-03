// Who speaks when — pure logic, no React, no storage. The cameo store feeds
// it context (current/highest world, recent speakers, settings) and renders
// whatever beats come back.
import { GUEST_CAST, TIER_KEYS, WORLD_CAST, type CharacterId, type TierKey } from '@/constants/cast';
import { CHARACTERS } from '@/constants/cameos';
import { linesFor, type CameoTrigger, type Speaker } from '@/constants/cameoLines';

export type { CameoTrigger, Speaker } from '@/constants/cameoLines';

export interface CameoVars {
  name?: string;
  lift?: string;
  weight?: string;
  reps?: string | number;
  power?: string;
  delta?: string;
  rank?: string;
  sub?: string;
  days?: string | number;
  streak?: string | number;
  weakest?: string;
  nextChar?: string;
  prevChar?: string;
}

export interface CameoContext {
  /** World whose cast is "current" (the active world) */
  currentTier: TierKey;
  /** Highest world ever reached — every world up to it is unlocked */
  highestTier: TierKey;
  /** Last 3 speakers, most recent last — nobody speaks twice in a row */
  recent: Speaker[];
  rand?: () => number;
}

export interface CameoBeat {
  speaker: Speaker;
  trigger: CameoTrigger;
  text: string;
  /** Powered-up moment: hype.png, jagged shout bubble, aura flash + speed lines */
  hype: boolean;
}

/** Random drop-ins are the only pool triggers guests join (Roshi, "very rarely"). */
const GUEST_POOL_TRIGGERS: CameoTrigger[] = ['home_dropin', 'rest_dropin'];
const POOL_GUESTS: CharacterId[] = ['roshi'];
const HYPE_TRIGGERS: CameoTrigger[] = ['pr_hit', 'rank_up_intro', 'rank_up_goodbye', 'heavy_day', 'over_9000'];

const tierIdx = (t: TierKey) => TIER_KEYS.indexOf(t);

/** Fill template vars; null when a line needs a var we don't have. */
export function fillLine(line: string, vars: CameoVars): string | null {
  let missing = false;
  const out = line.replace(/\{(\w+)\}/g, (_, k: keyof CameoVars) => {
    const v = vars[k];
    if (v == null || v === '') { missing = true; return ''; }
    return String(v);
  });
  return missing ? null : out;
}

function usableLines(trigger: CameoTrigger, speaker: Speaker, vars: CameoVars): string[] {
  return linesFor(trigger, speaker).map(l => fillLine(l, vars)).filter((l): l is string => l != null);
}

function weighted<T>(items: { item: T; w: number }[], rand: () => number): T | null {
  const total = items.reduce((s, x) => s + x.w, 0);
  if (total <= 0) return null;
  let r = rand() * total;
  for (const x of items) { r -= x.w; if (r <= 0) return x.item; }
  return items[items.length - 1].item;
}

function castWeights(tier: TierKey, includeSystem: boolean): { item: Speaker; w: number }[] {
  const out: { item: Speaker; w: number }[] = WORLD_CAST[tier].map((id, i) => ({
    item: id as Speaker,
    // Lead is twice as likely as each drop-in; placeholder art is half as likely.
    w: (i === 0 ? 2 : 1) * (CHARACTERS[id].placeholder ? 0.5 : 1),
  }));
  if (includeSystem && tier === 'sovereign') out.push({ item: 'system', w: 1 });
  return out;
}

/**
 * The random pool: 60% current world's cast, 30% unlocked worlds below,
 * 10% guests (when the trigger allows). Skips the last 3 speakers and anyone
 * without a usable line for this trigger.
 */
export function pickFromPool(trigger: CameoTrigger, vars: CameoVars, ctx: CameoContext): Speaker | null {
  const rand = ctx.rand ?? Math.random;
  const ok = (s: Speaker) => !ctx.recent.slice(-3).includes(s) && usableLines(trigger, s, vars).length > 0;
  const filter = (xs: { item: Speaker; w: number }[]) => xs.filter(x => ok(x.item));

  const current = filter(castWeights(ctx.currentTier, true));
  const lower = filter(
    TIER_KEYS.filter(t => tierIdx(t) < tierIdx(ctx.highestTier) && t !== ctx.currentTier)
      .flatMap(t => castWeights(t, false)),
  );
  const guests = GUEST_POOL_TRIGGERS.includes(trigger)
    ? filter(POOL_GUESTS.map(id => ({ item: id as Speaker, w: 1 })))
    : [];

  const buckets = [
    { item: current, w: current.length ? 60 : 0 },
    { item: lower, w: lower.length ? 30 : 0 },
    { item: guests, w: guests.length ? 10 : 0 },
  ];
  const bucket = weighted(buckets, rand);
  return bucket ? weighted(bucket, rand) : null;
}

function beat(trigger: CameoTrigger, speaker: Speaker, vars: CameoVars, rand: () => number): CameoBeat | null {
  const lines = usableLines(trigger, speaker, vars);
  if (!lines.length) return null;
  return { speaker, trigger, text: lines[Math.floor(rand() * lines.length)], hype: HYPE_TRIGGERS.includes(trigger) };
}

export interface TriggerExtras {
  /** pr_hit: squat/bench/deadlift PR */
  canonicalPR?: boolean;
  /** pr_hit: lbs beaten over the old PR */
  prGainLbs?: number;
  /** heavy_day: which guest spoke last time, so they alternate */
  lastHeavyGuest?: CharacterId | null;
  /** rank_up: the world being left */
  fromTier?: TierKey;
}

/**
 * Resolve a trigger to one or more beats (rank_up is a two-beat handoff:
 * the old lead's goodbye, then the new lead's intro). Empty = stay silent.
 */
export function resolveCameo(
  trigger: CameoTrigger | 'rank_up',
  vars: CameoVars,
  ctx: CameoContext,
  extras: TriggerExtras = {},
): CameoBeat[] {
  const rand = ctx.rand ?? Math.random;
  const lead = WORLD_CAST[ctx.currentTier][0] as Speaker;
  const one = (t: CameoTrigger, s: Speaker | null) => {
    const b = s ? beat(t, s, vars, rand) : null;
    return b ? [b] : [];
  };

  switch (trigger) {
    case 'rank_up': {
      const from = extras.fromTier ?? TIER_KEYS[Math.max(0, tierIdx(ctx.currentTier) - 1)];
      const oldLead = WORLD_CAST[from][0];
      const v = { ...vars, nextChar: CHARACTERS[lead as CharacterId].name, prevChar: CHARACTERS[oldLead].name };
      const beats: CameoBeat[] = [];
      const bye = beat('rank_up_goodbye', oldLead, v, rand);
      if (bye) beats.push(bye);
      // Garou's flavor beat when climbing from Sovereign to Godhand.
      if (from === 'sovereign' && ctx.currentTier === 'godhand') {
        const g = beat('rank_up_goodbye', 'garou', v, rand);
        if (g) beats.push(g);
      }
      const hi = beat('rank_up_intro', lead, v, rand);
      if (hi) beats.push(hi);
      return beats;
    }
    case 'pr_hit': {
      if (extras.canonicalPR || (extras.prGainLbs ?? 0) >= 10) {
        const guest: CharacterId = rand() < 0.5 ? 'broly' : 'yujiro';
        return one('pr_hit', guest);
      }
      return one('pr_hit', pickFromPool('pr_hit', vars, ctx));
    }
    case 'heavy_day': {
      const guest: CharacterId = extras.lastHeavyGuest === 'broly' ? 'yujiro' : 'broly';
      return one('heavy_day', guest);
    }
    case 'over_9000':
      return one('over_9000', 'vegeta');
    case 'sub_rank_up':
    case 'onboarding_reveal':
      return one(trigger, lead);
    case 'comeback':
      return one('comeback', rand() < 0.5 ? 'roshi' : lead);
    default:
      return one(trigger, pickFromPool(trigger, vars, ctx));
  }
}

/** At finish only one cameo shows, by this priority. */
export const FINISH_PRIORITY: (CameoTrigger | 'rank_up')[] = [
  'over_9000', 'rank_up', 'heavy_day', 'power_jump', 'sub_rank_up', 'comeback', 'workout_finished',
];

export function isGuest(id: Speaker): boolean {
  return (GUEST_CAST as readonly string[]).includes(id);
}
