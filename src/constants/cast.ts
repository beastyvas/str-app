// Single source of truth for who is in each world's cast. The Coach tab,
// cameos, rank ladder, and roster gallery all read from here.
import type { RankTier } from './ranks';

export type TierKey = RankTier['key'];

export const TIER_KEYS: TierKey[] = ['mortal', 'awakened', 'ascendant', 'phantom', 'sovereign', 'godhand'];

/** Lead first (the coach), then the five drop-ins. */
export const WORLD_CAST = {
  mortal: ['urokodaki', 'tanjiro', 'zenitsu', 'inosuke', 'rengoku', 'giyu'],
  awakened: ['allmight', 'deku', 'bakugo', 'todoroki', 'kirishima', 'aizawa'],
  ascendant: ['gojo', 'yuji', 'megumi', 'maki', 'todo', 'sukuna'],
  phantom: ['vegeta', 'goku', 'gohan', 'piccolo', 'beerus', 'whis'],
  sovereign: ['jinwoo', 'igris', 'beru', 'chahaein', 'thomasandre', 'yoojinho'],
  godhand: ['saitama', 'genos', 'bang', 'king', 'mumenrider', 'garou'],
} as const satisfies Record<TierKey, readonly string[]>;

export const GUEST_CAST = ['broly', 'yujiro', 'roshi'] as const;

export type WorldCharacterId = (typeof WORLD_CAST)[TierKey][number];
export type GuestId = (typeof GUEST_CAST)[number];
export type CharacterId = WorldCharacterId | GuestId;

export const ALL_CHARACTER_IDS: CharacterId[] = [
  ...TIER_KEYS.flatMap(k => WORLD_CAST[k] as readonly CharacterId[]),
  ...GUEST_CAST,
];

export function leadOf(tier: TierKey): CharacterId {
  return WORLD_CAST[tier][0];
}
