// Session-type vocabulary shared by Home, Profile, and the friend profile.
// One palette, one emoji set, and the two classifiers that previously lived
// as duplicated module-level copies in those screens.

export const SESSION_COLORS: Record<string, string> = {
  Push: '#C2566B',
  Pull: '#3B82F6',
  Legs: '#F97316',
  Upper: '#A855F7',
  Lower: '#22C55E',
  'Full Body': '#EAB308',
  Core: '#14B8A6',
  Training: '#888888',
};

export const SESSION_EMOJI: Record<string, string> = {
  Push: '💪',
  Pull: '🎯',
  Legs: '🦵',
  Upper: '⬆️',
  Lower: '🔽',
  'Full Body': '🔥',
  Core: '🧘',
  Training: '🏋️',
};

export const SESSION_TYPES = ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body', 'Core'];

/** Classify a session from its exercise NAMES (Home's suggestion logic). */
export function classifySessionFromNames(exercises: string[]): string | null {
  const s = exercises.join(' ').toLowerCase();
  const push = /bench|chest|fly|press|tricep|shoulder|dip/.test(s);
  const pull = /row|pull-?up|chin|lat|curl|bicep|shrug/.test(s);
  const legs = /squat|leg press|lunge|hamstring|glute|calf|hip thrust|rdl/.test(s);
  const core = /crunch|plank|\bab\b|core|oblique/.test(s);
  if (push && pull && legs) return 'Full Body';
  if ((push || pull) && legs) return 'Upper';
  if (push && pull) return 'Upper';
  if (push) return 'Push';
  if (pull) return 'Pull';
  if (legs) return 'Legs';
  if (core) return 'Core';
  return null;
}

/** Classify a session from its sets' MUSCLE GROUPS (friend profile split detection). */
export function classifySessionFromSets(sets: any[]): string {
  const groups = [...new Set(sets.map((s: any) => (s.exercises?.muscle_group ?? '').toLowerCase()).filter(Boolean))];
  const hasPush = groups.some(g => ['chest', 'shoulder', 'tricep'].some(m => g.includes(m)));
  const hasPull = groups.some(g => ['back', 'bicep', 'lat'].some(m => g.includes(m)));
  const hasLegs = groups.some(g => ['quad', 'hamstring', 'glute', 'calf'].some(m => g.includes(m)));
  if (hasPush && hasPull && hasLegs) return 'Full Body';
  if (hasLegs && (hasPush || hasPull)) return 'Full Body';
  if (hasPush && hasPull) return 'Upper';
  if (hasPush) return 'Push';
  if (hasPull) return 'Pull';
  if (hasLegs) return 'Legs';
  return 'Other';
}
