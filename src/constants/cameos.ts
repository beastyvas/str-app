// Cast registry: castData.json (names, series, role, bubble color — shared
// with the asset scripts) merged with the generated image registry.
import castData from './castData.json';
import { CAMEO_IMAGES, type CameoImages } from './cameoRegistry.generated';
import type { CharacterId, TierKey } from './cast';

export interface CameoCharacter extends CameoImages {
  id: CharacterId;
  name: string;
  series: string;
  tier: TierKey | null;
  role: 'lead' | 'dropin' | 'guest';
  /** The character's own color (Gojo blue, Bakugo orange, Saitama yellow…) */
  bubbleColor: string;
}

export const CHARACTERS: Record<CharacterId, CameoCharacter> = Object.fromEntries(
  (castData as Omit<CameoCharacter, keyof CameoImages>[]).map(c => [c.id, { ...c, ...CAMEO_IMAGES[c.id] }]),
) as Record<CharacterId, CameoCharacter>;

export function characterOf(id: CharacterId): CameoCharacter {
  return CHARACTERS[id];
}

/** "Gojo, The Tactician" */
export function leadTitle(id: CharacterId, coachName: string): string {
  return `${CHARACTERS[id].name}, ${coachName}`;
}
