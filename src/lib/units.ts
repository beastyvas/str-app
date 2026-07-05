// Weight-unit conversion at the display/input boundary. Storage is ALWAYS lbs
// (workout_sets.weight, personal_records, bodyweight_lbs, strength standards);
// only what the user sees and types is in their preferred unit.

export type WeightUnit = 'lbs' | 'kg';

export const LBS_PER_KG = 2.2046226218;

/** DB lbs → display number in the user's unit (kg gets 1 decimal, lbs stays clean) */
export function toDisplay(lbs: number, unit: WeightUnit): number {
  if (unit === 'kg') return Math.round((lbs / LBS_PER_KG) * 10) / 10;
  return Math.round(lbs * 10) / 10;
}

/** User-typed number in their unit → lbs for storage */
export function toLbs(value: number, unit: WeightUnit): number {
  if (unit === 'kg') return Math.round(value * LBS_PER_KG * 100) / 100;
  return value;
}

/** "225 lbs" / "102.5 kg" */
export function fmtWeight(lbs: number, unit: WeightUnit): string {
  return `${toDisplay(lbs, unit)} ${unit}`;
}

/** Volume totals: "12.5k lbs" / "5.7k kg" */
export function fmtVolume(lbsTotal: number, unit: WeightUnit): string {
  const v = unit === 'kg' ? lbsTotal / LBS_PER_KG : lbsTotal;
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k ${unit}` : `${Math.round(v)} ${unit}`;
}

/** Normalize whatever is in profile.unit_pref to a safe unit */
export function unitFromProfile(unitPref?: string | null): WeightUnit {
  return unitPref === 'kg' ? 'kg' : 'lbs';
}
