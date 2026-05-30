// Workout log parser — built for real gym log formats
// Handles: "1 set of 75x10 for working set (rpe 9, note)", plates, bw, bar

export interface ParsedSet {
  weight: number;
  reps: number;
  rpe?: number;
  note?: string;
}

export interface ParsedExercise {
  rawName: string;
  matchedName: string;
  matchedId: string | null;
  sets: ParsedSet[];
}

export interface ParsedWorkout {
  name: string;
  date: Date;
  exercises: ParsedExercise[];
}

// ── WEIGHT CONVERSION ──────────────────────────────────────────────────────

// "3.25plates" → (2 * 3.25 + 1) * 45 = 337.5 lbs (standard barbell plates)
function platesToLbs(plates: number): number {
  return Math.round((2 * plates + 1) * 45 * 10) / 10;
}

function parseWeight(raw: string): number | null {
  const s = raw.toLowerCase().trim();
  if (s === 'bw' || s === 'bodyweight' || s === 'bwt') return 0;
  if (s === 'bar' || s === 'barbell') return 45;

  // "3.25plates" or "3plates"
  const platesMatch = s.match(/^(\d+(?:\.\d+)?)\s*plates?$/);
  if (platesMatch) return platesToLbs(parseFloat(platesMatch[1]));

  // Plain number
  const num = parseFloat(s);
  if (!isNaN(num) && num >= 0) return num;

  return null;
}

// ── RPE PARSING ────────────────────────────────────────────────────────────

function parseRPE(str: string): number | undefined {
  const s = str.toLowerCase();
  // "rpe fail" / "rpe FAIL" → 10
  if (/rpe\s*(fail|failure|f\b)/.test(s)) return 10;
  // "rpe 9", "rpe9", "rpe 9.5", "@9"
  const m = s.match(/(?:rpe\s*|@\s*)(\d+(?:\.\d+)?)/);
  if (m) {
    const v = parseFloat(m[1]);
    if (v >= 1 && v <= 10) return v;
  }
  return undefined;
}

// ── REP PARSING ────────────────────────────────────────────────────────────

// "11/10" → 11 (full reps, ignore partials)
// "12,3" → 12 (take first number)
// "8.5" → 8
// "12.5" → 12
function parseReps(raw: string): number {
  const first = raw.split(/[\/,]/)[0].trim();
  return Math.floor(parseFloat(first));
}

// ── ABBREVIATION DICTIONARY ────────────────────────────────────────────────

const ABBREV: Record<string, string> = {
  // Chest
  'bp': 'Barbell Bench Press',
  'bench': 'Barbell Bench Press',
  'bench press': 'Barbell Bench Press',
  'flat bench': 'Barbell Bench Press',
  'flat db press': 'Dumbbell Bench Press',
  'db bench': 'Dumbbell Bench Press',
  'dumbbell bench': 'Dumbbell Bench Press',
  'db press': 'Dumbbell Bench Press',
  'incline bench': 'Incline Barbell Bench Press',
  'incline bp': 'Incline Barbell Bench Press',
  'incline press': 'Incline Barbell Bench Press',
  'incline db': 'Incline Dumbbell Press',
  'incline dumbbell': 'Incline Dumbbell Press',
  'incline db press': 'Incline Dumbbell Press',
  'isolateral incline': 'Incline Machine Press',
  'isolateral incline machine': 'Incline Machine Press',
  'incline machine': 'Incline Machine Press',
  'pec deck': 'Pec Deck Cable Flys',
  'cable fly': 'Pec Deck Cable Flys',
  'cable flys': 'Pec Deck Cable Flys',
  'cable chest fly': 'Pec Deck Cable Flys',
  'dips': 'Dips',
  // Shoulders
  'ohp': 'Overhead Press',
  'overhead press': 'Overhead Press',
  'military press': 'Overhead Press',
  'seated db press': 'Dumbbell Shoulder Press',
  'db shoulder press': 'Dumbbell Shoulder Press',
  'db ohp': 'Dumbbell Shoulder Press',
  'shoulder press': 'Dumbbell Shoulder Press',
  'dumbbell shoulder press': 'Dumbbell Shoulder Press',
  'lateral raise': 'Dumbbell Lateral Raise',
  'laterals': 'Dumbbell Lateral Raise',
  'lat raise': 'Dumbbell Lateral Raise',
  'lateral raise cables': 'Cable Lateral Raise',
  'lateral raise machine': 'Lateral Raise Machine',
  'cable lateral raise': 'Cable Lateral Raise',
  'cable lateral': 'Cable Lateral Raise',
  'rear delt fly': 'Rear Delt Fly',
  'rear delt': 'Rear Delt Fly',
  'face pull': 'Face Pulls',
  'face pulls': 'Face Pulls',
  // Back
  'pullup': 'Pullups',
  'pullups': 'Pullups',
  'pull up': 'Pullups',
  'pull ups': 'Pullups',
  'chinup': 'Pullups',
  'assisted pull-up': 'Pullups',
  'assisted pullup': 'Pullups',
  'lat pulldown': 'Lat Pulldowns',
  'lat pulldowns': 'Lat Pulldowns',
  'pulldown': 'Lat Pulldowns',
  'bb row': 'Barbell Row',
  'barbell row': 'Barbell Row',
  'bent over row': 'Barbell Row',
  'pendlay': 'Pendlay Row',
  't-bar': 'T-Bar Row',
  'tbar': 'T-Bar Row',
  'cable row': 'Seated Cable Row',
  'seated row': 'Seated Cable Row',
  'seated cable row': 'Seated Cable Row',
  'isolateral row': 'Seated Cable Row',        // closest match
  'isolateral low row': 'Seated Cable Row',
  'iso lateral row': 'Seated Cable Row',
  // Biceps
  'curl': 'Bicep Curl',
  'curls': 'Bicep Curl',
  'bb curl': 'Bicep Curl',
  'hammer curl': 'Hammer Curl',
  'hammer curls': 'Hammer Curl',
  'machine hammer curl': 'Hammer Curl',
  'preacher curl': 'Preacher Curl',
  'spider curl': 'Spider Curl',
  'incline curl': 'Incline Curl',
  'cable curl': 'Cable Curl',
  'concentration curl': 'Concentration Curl',
  // Triceps
  'skullcrusher': 'Skull Crushers',
  'skull crusher': 'Skull Crushers',
  'skull crushers': 'Skull Crushers',
  'cgbp': 'Close Grip Bench Press',
  'close grip': 'Close Grip Bench Press',
  'tricep pushdown': 'Overhand Pushdowns',
  'pushdowns': 'Overhand Pushdowns',
  'cable extension': 'Standing Cable Extension',
  'overhead extension': 'Katana Extensions',
  'tricep extension': 'Standing Cable Extension',
  'katana': 'Katana Extensions',
  'kickback': 'Cable Kickback',
  // Legs
  'squat': 'Barbell Back Squats',
  'squats': 'Barbell Back Squats',
  'back squat': 'Barbell Back Squats',
  'bb squat': 'Barbell Back Squats',
  'hack squat': 'Hack Squats',
  'leg press': 'Leg Press',
  'leg extension': 'Leg Extensions',
  'leg extensions': 'Leg Extensions',
  'uni lateral leg extension': 'Leg Extensions',
  'unilateral leg extension': 'Leg Extensions',
  'leg curl': 'Leg Curl',
  'leg curls': 'Leg Curl',
  'rdl': 'Barbell RDLs',
  'romanian deadlift': 'Barbell RDLs',
  'romanian dl': 'Barbell RDLs',
  'db rdl': 'Dumbbell RDLs',
  'good morning': 'Good Mornings',
  'goblet squat': 'Goblet Squats',
  'bulgarian split squat': 'Bulgarian Split Squat',
  'bss': 'Bulgarian Split Squat',
  'bulgarian': 'Bulgarian Split Squat',
  'split squat': 'Bulgarian Split Squat',
  'lunges': 'Walking Lunges',
  'reverse lunge': 'Reverse Lunges',
  // Glutes
  'hip thrust': 'Hip Thrust',
  'hip thrusts': 'Hip Thrust',
  'glute bridge': 'KAS Glute Bridge',
  'kas': 'KAS Glute Bridge',
  'back extension': 'Glute Focused Back Extension',
  'glute focused back extension': 'Glute Focused Back Extension',
  'glute back extension': 'Glute Focused Back Extension',
  // Deadlifts
  'dl': 'Deadlifts',
  'deadlift': 'Deadlifts',
  'deadlifts': 'Deadlifts',
  'conventional': 'Deadlifts',
};

export function matchExerciseName(
  raw: string,
  dbExercises: { id: string; name: string }[]
): { matchedName: string; matchedId: string | null } {
  // Strip leading bullets, trailing rep schemes, extra whitespace
  let normalized = raw
    .replace(/^[∙•\-\*\s]+/, '')             // leading bullets
    .replace(/\s*[—\-]+\s*\d+[×x]\d+.*$/, '') // "— 4×8-10" rep scheme
    .replace(/\s*\d+[×x]\d+.*$/, '')           // "3×8" rep scheme
    .replace(/\(.*\)$/, '')                    // trailing parens
    .toLowerCase()
    .trim();

  // Exact abbrev match
  if (ABBREV[normalized]) {
    const name = ABBREV[normalized];
    const db = dbExercises.find(e => e.name.toLowerCase() === name.toLowerCase());
    return { matchedName: name, matchedId: db?.id ?? null };
  }

  // Exact DB match
  const exact = dbExercises.find(e => e.name.toLowerCase() === normalized);
  if (exact) return { matchedName: exact.name, matchedId: exact.id };

  // Partial abbrev match (abbrev is contained in normalized or vice versa)
  for (const [abbr, name] of Object.entries(ABBREV)) {
    if (normalized.includes(abbr) || abbr.includes(normalized)) {
      const db = dbExercises.find(e => e.name.toLowerCase() === name.toLowerCase());
      return { matchedName: name, matchedId: db?.id ?? null };
    }
  }

  // DB contains match
  const contains = dbExercises.find(e =>
    e.name.toLowerCase().includes(normalized) || normalized.includes(e.name.toLowerCase())
  );
  if (contains) return { matchedName: contains.name, matchedId: contains.id };

  // Word overlap
  const rawWords = normalized.split(/\s+/).filter(w => w.length > 2);
  let bestScore = 0, bestMatch: typeof dbExercises[0] | null = null;
  for (const ex of dbExercises) {
    const exWords = ex.name.toLowerCase().split(/\s+/);
    const score = rawWords.filter(w => exWords.some(e => e.includes(w) || w.includes(e))).length;
    if (score > bestScore) { bestScore = score; bestMatch = ex; }
  }
  if (bestScore >= 1 && bestMatch) return { matchedName: bestMatch.name, matchedId: bestMatch.id };

  const titleCase = raw.trim().replace(/^[∙•\-\*]+\s*/, '').replace(/\b\w/g, c => c.toUpperCase());
  return { matchedName: titleCase, matchedId: null };
}

// ── SET LINE PARSER ────────────────────────────────────────────────────────

// Parses: "1 set of 75x11/10 for working set (rpe fail, FANTASTIC)"
// Also handles: "225x5", "225x5x3", "3.25platesx8"
function parseSetLine(line: string): ParsedSet | null {
  const lower = line.toLowerCase();

  // Skip lines that are clearly not sets
  if (/^\s*(skipped|skip|rest|core|mobility|warmup note|•|∙)/.test(lower)) return null;
  if (/^\s*\d+\s+(min|minute|sec|second)/.test(lower)) return null;

  // Format: "N set(s) of WEIGHTxREPS for TYPE (notes)"
  const longForm = line.match(
    /\d+\s+sets?\s+of\s+([a-z0-9._]+)x([\d.,\/]+(?:\.5)?)\s+for\s+(warmup|working set|work)(.*)/i
  );
  if (longForm) {
    const weightStr = longForm[1];
    const repStr = longForm[2];
    const type = longForm[3].toLowerCase();
    const notes = longForm[4] ?? '';

    const weight = parseWeight(weightStr);
    if (weight === null) return null;
    const reps = parseReps(repStr);
    if (reps <= 0 || reps > 100) return null;

    const rpe = parseRPE(notes);
    const noteText = notes
      .replace(/\(|\)/g, '')
      .replace(/rpe\s*(fail|failure|\d+(?:\.\d+)?)/gi, '')
      .replace(/[,\s]+/g, ' ')
      .trim();

    return {
      weight,
      reps,
      rpe,
      note: noteText.length > 3 ? noteText.substring(0, 80) : undefined,
    };
  }

  // Short format: "225x5", "225x5x3", "3.25platesx8", "bwx10"
  const shortForm = line.trim().match(/^([a-z0-9._]+)x([\d.]+)(?:x(\d+))?/i);
  if (shortForm && !line.toLowerCase().includes('warmup')) {
    const weight = parseWeight(shortForm[1]);
    if (weight === null) return null;
    const reps = Math.floor(parseFloat(shortForm[2]));
    if (reps <= 0 || reps > 100) return null;
    const rpe = parseRPE(line);
    return { weight, reps, rpe };
  }

  return null;
}

// ── DATE DETECTION ─────────────────────────────────────────────────────────

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function detectDate(line: string): Date | null {
  const trimmed = line.trim();

  // MM/DD/YYYY or MM/DD/YY
  const m1 = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (m1) {
    let [, mo, dy, yr] = m1;
    let year = parseInt(yr);
    if (year < 100) year += 2000;
    const date = new Date(year, parseInt(mo) - 1, parseInt(dy));
    if (!isNaN(date.getTime())) return date;
  }

  const l = trimmed.toLowerCase();

  // "April 2, 2024" / "April 2"
  for (let i = 0; i < MONTHS.length; i++) {
    if (l.startsWith(MONTHS[i])) {
      const rest = l.slice(MONTHS[i].length).trim();
      const dayMatch = rest.match(/^\.?\s*(\d{1,2})/);
      if (dayMatch) {
        const yearMatch = rest.match(/(\d{4})/);
        const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
        return new Date(year, i, parseInt(dayMatch[1]));
      }
    }
  }

  // Day name lines: "MON — Upper..." or "TUE — Lower..."
  for (const day of DAYS) {
    if (l.startsWith(day)) {
      // Has embedded date?
      const embedded = trimmed.match(/(\d{1,2})[\/\-](\d{1,2})/);
      if (embedded) {
        return new Date(new Date().getFullYear(), parseInt(embedded[1]) - 1, parseInt(embedded[2]));
      }
      // Just a day name — return null, wait for explicit date
      return null;
    }
  }

  return null;
}

// ── EXERCISE LINE DETECTION ────────────────────────────────────────────────

function isExerciseLine(line: string): boolean {
  const trimmed = line.trim();
  // Bullet point style: "∙ Bulgarian Split Squat" or "• Hip Thrust"
  if (/^[∙•]/.test(trimmed)) return true;
  // Pure letter line with no numbers (possible exercise header without bullet)
  if (/^[a-zA-Z]/.test(trimmed) && !/\d+\s*[x×]\s*\d+/.test(trimmed) && !/\d+\s+set/.test(trimmed.toLowerCase())) {
    const words = trimmed.split(/\s+/);
    const letterWords = words.filter(w => /[a-zA-Z]{2,}/.test(w));
    return letterWords.length >= 1;
  }
  return false;
}

function isWorkoutHeader(line: string): boolean {
  const l = line.toLowerCase().trim();
  // "TUE — Lower (Quad Focus)" or "MON — Upper (Chest Focus)"
  return /^(mon|tue|wed|thu|fri|sat|sun)\w*\s*[—\-]/.test(l) ||
    /\b(upper|lower|push|pull|legs?|chest|back|shoulder|arm)\b.*focus/i.test(line);
}

function isWarmupLine(line: string): boolean {
  return /for warmup/i.test(line) || /warmup set/i.test(line);
}

function isSkipLine(line: string): boolean {
  const l = line.toLowerCase().trim();
  return l.startsWith('skipped') || l.startsWith('skip') ||
    l.startsWith('workings') || l.startsWith('working') ||
    l.startsWith('core') || l.startsWith('mobility') ||
    l.startsWith('stairmaster') || l.startsWith('cardio') ||
    /^\d+\s+(min|sec|minute)/.test(l) ||
    l.length > 200; // very long lines are usually journal entries
}

// ── MAIN PARSER ────────────────────────────────────────────────────────────

export function parseWorkoutLog(
  text: string,
  dbExercises: { id: string; name: string }[]
): ParsedWorkout[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const workouts: ParsedWorkout[] = [];

  let currentWorkout: ParsedWorkout | null = null;
  let currentExercise: ParsedExercise | null = null;
  let pendingDate: Date | null = null;
  let workoutName = '';

  const flushExercise = () => {
    if (currentExercise && currentExercise.sets.length > 0 && currentWorkout) {
      currentWorkout.exercises.push(currentExercise);
    }
    currentExercise = null;
  };

  const flushWorkout = () => {
    flushExercise();
    if (currentWorkout && currentWorkout.exercises.length > 0) {
      workouts.push(currentWorkout);
    }
    currentWorkout = null;
  };

  for (const line of lines) {
    if (isSkipLine(line)) continue;

    // ── DATE LINE
    const date = detectDate(line);
    if (date) {
      // If there's already a workout being built with a different date, flush it
      if (currentWorkout && currentWorkout.date.toDateString() !== date.toDateString()) {
        flushWorkout();
      }
      pendingDate = date;
      workoutName = '';
      continue;
    }

    // ── WORKOUT HEADER (e.g. "TUE — Lower (Quad Focus)")
    if (isWorkoutHeader(line)) {
      if (currentWorkout && workoutName && currentWorkout.exercises.length === 0) {
        // Update name of existing workout
        currentWorkout.name = line.trim();
      } else {
        flushWorkout();
        currentWorkout = {
          name: line.trim(),
          date: pendingDate ?? new Date(),
          exercises: [],
        };
        pendingDate = null;
      }
      workoutName = line.trim();
      continue;
    }

    // Ensure we have a current workout
    if (!currentWorkout) {
      currentWorkout = {
        name: workoutName || 'Imported Workout',
        date: pendingDate ?? new Date(),
        exercises: [],
      };
      pendingDate = null;
    }

    // ── EXERCISE LINE (bullet or plain header)
    if (isExerciseLine(line) && !isWarmupLine(line)) {
      const hasSetData = /\d+\s+set\s+of/i.test(line) || /\d+\s*[x×]\s*\d+/.test(line);
      if (!hasSetData) {
        flushExercise();
        const match = matchExerciseName(line, dbExercises);
        currentExercise = { rawName: line, ...match, sets: [] };
        continue;
      }
    }

    // ── WARMUP LINE — skip (only keep working sets)
    if (isWarmupLine(line)) continue;

    // ── SET LINE
    const parsed = parseSetLine(line);
    if (parsed) {
      if (!currentExercise) {
        // Orphaned set — attach to last exercise or create unknown
        currentExercise = {
          rawName: 'Unknown',
          matchedName: 'Unknown',
          matchedId: null,
          sets: [],
        };
      }
      currentExercise.sets.push(parsed);
    }
  }

  flushWorkout();
  return workouts;
}
