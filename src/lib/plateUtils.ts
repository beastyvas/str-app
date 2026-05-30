// Plate system utilities

export type PlateSystem = 'lbs' | 'kg';

export interface PlateConfig {
  system: PlateSystem;
  barWeight: number;
  plateOptions: number[]; // per-side increments
  label: string;
}

export const PLATE_CONFIGS: Record<PlateSystem, PlateConfig> = {
  lbs: {
    system: 'lbs',
    barWeight: 45,
    plateOptions: [45, 25, 10, 5, 2.5],
    label: 'lbs',
  },
  kg: {
    system: 'kg',
    barWeight: 20,
    plateOptions: [20, 10, 5, 2.5, 1.25],
    label: 'kg',
  },
};

// Equipment type → default weight entry mode
export type WeightMode = 'number' | 'bw' | 'plates';

export function defaultModeForEquipment(equipmentType?: string): WeightMode {
  if (!equipmentType) return 'number';
  const e = equipmentType.toLowerCase();
  if (['bodyweight', 'rings'].includes(e)) return 'bw';
  if (['barbell', 'safety bar', 'trap bar', 'ez bar'].includes(e)) return 'plates';
  return 'number';
}

// Format plate breakdown for display
// e.g. 225 lbs → "2 × 45 + 25 per side"
export function describeWeight(totalLbs: number, config: PlateConfig): string {
  const perSide = (totalLbs - config.barWeight) / 2;
  if (perSide <= 0) return `Bar only (${config.barWeight} ${config.label})`;

  let remaining = perSide;
  const plates: string[] = [];
  for (const p of config.plateOptions) {
    const count = Math.floor(remaining / p + 0.001);
    if (count > 0) {
      plates.push(count > 1 ? `${count}×${p}` : `${p}`);
      remaining -= count * p;
    }
  }
  return plates.length > 0 ? `${plates.join(' + ')} per side` : `${perSide} ${config.label}/side`;
}
