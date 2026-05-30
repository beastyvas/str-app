// Workout log parser v3 — built for real messy gym logs
// Primary format: "1 set of WEIGHTxREPS for working set (rpe X, note)"
// Also supports Hevy CSV export format

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

// ── WEIGHT HELPERS ─────────────────────────────────────────────────────────

// Plate notation: N.MM plates
//   Whole part = number of 45lb plates per side
//   Decimal × 100 = fractional plate weight (e.g. .25 → 25lb, .05 → 5lb, .10 → 10lb)
//   × 2 for bilateral machines (both sides loaded equally)
// Examples: 2.25 → (2×45 + 25) × 2 = 230,  3.05 → (3×45 + 5) × 2 = 280
function platesToLbs(n: number): number {
  const whole = Math.floor(n);
  const fracPlate = Math.round((n - whole) * 100); // .25 → 25, .05 → 5
  const perSide = whole * 45 + fracPlate;
  return perSide * 2; // both sides
}

function parseWeight(raw: string): number | null {
  // Take first number for ranges like "160/170"
  const s = raw.toLowerCase().trim().split('/')[0].trim();
  if (s === 'bw' || s === 'bodyweight' || s === 'bwt') return 0;
  if (s === 'bar' || s === 'barbell' || s === 'empty bar') return 45;
  const pm = s.match(/^(\d+(?:\.\d+)?)\s*plates?$/);
  if (pm) return platesToLbs(parseFloat(pm[1]));
  const n = parseFloat(s);
  return isNaN(n) || n < 0 ? null : n;
}

// ── RPE ────────────────────────────────────────────────────────────────────

function parseRPE(str: string): number | undefined {
  const s = str.toLowerCase();
  if (/rpe\s*(fail|failure)\b/.test(s)) return 10;
  const m = s.match(/(?:rpe\s*|@\s*)(\d+(?:\.\d+)?)/);
  if (m) {
    const v = parseFloat(m[1]);
    return v >= 1 && v <= 10 ? v : undefined;
  }
  return undefined;
}

// ── REPS ───────────────────────────────────────────────────────────────────

// "11/10" → 11, "12,3" → 12, "8.5" → 8, "9.5" → 9
function parseReps(raw: string): number {
  return Math.floor(parseFloat(raw.split(/[\/,]/)[0].trim()));
}

// ── EXERCISE ABBREVIATIONS ─────────────────────────────────────────────────

const ABBREV: Record<string, string> = {
  // Chest
  'bp': 'Barbell Bench Press',
  'bench': 'Barbell Bench Press',
  'bench press': 'Barbell Bench Press',
  'flat bench': 'Barbell Bench Press',
  'flat db press': 'Dumbbell Bench Press',
  'db bench': 'Dumbbell Bench Press',
  'dumbbell bench': 'Dumbbell Bench Press',
  'incline bench': 'Incline Barbell Bench Press',
  'incline bp': 'Incline Barbell Bench Press',
  'incline db': 'Incline Dumbbell Press',
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
  'cable row': 'Seated Cable Row',
  'seated row': 'Seated Cable Row',
  'seated cable row': 'Seated Cable Row',
  'isolateral row': 'Seated Cable Row',
  'isolateral low row': 'Seated Cable Row',
  'iso lateral row': 'Seated Cable Row',
  'iso row': 'Seated Cable Row',
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
  'skull crusher': 'Skull Crushers',
  'skull crushers': 'Skull Crushers',
  'skullcrusher': 'Skull Crushers',
  'cgbp': 'Close Grip Bench Press',
  'close grip': 'Close Grip Bench Press',
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
  'glute focused back ext': 'Glute Focused Back Extension',
  // Deadlifts
  'dl': 'Deadlifts',
  'deadlift': 'Deadlifts',
  'deadlifts': 'Deadlifts',
  'conventional': 'Deadlifts',
};

// ── EXERCISE NAME MATCHING ──────────────────────────────────────────────────

export function matchExerciseName(
  raw: string,
  dbExercises: { id: string; name: string }[]
): { matchedName: string; matchedId: string | null } {
  // Strip bullets, tab characters, rep schemes, trailing info
  const cleaned = raw
    .replace(/[\t]/g, ' ')
    .replace(/^[\s∙•\-\*]+/, '')          // leading bullets/spaces
    .replace(/\s*[—–\-]+\s*\d+.*$/, '')   // trailing "— 4×8-10"
    .replace(/\s*\d+\s*[x×]\s*\d+.*$/, '') // trailing "3×8-10"
    .replace(/\(.*?\)/g, '')               // parentheses
    .replace(/\s+/g, ' ')
    .trim();

  const normalized = cleaned.toLowerCase();

  // Exact abbrev
  if (ABBREV[normalized]) {
    const name = ABBREV[normalized];
    const db = dbExercises.find(e => e.name.toLowerCase() === name.toLowerCase());
    return { matchedName: name, matchedId: db?.id ?? null };
  }

  // Try progressively shorter substrings of normalized (handles extra words)
  const words = normalized.split(/\s+/);
  for (let len = words.length; len >= 2; len--) {
    const sub = words.slice(0, len).join(' ');
    if (ABBREV[sub]) {
      const name = ABBREV[sub];
      const db = dbExercises.find(e => e.name.toLowerCase() === name.toLowerCase());
      return { matchedName: name, matchedId: db?.id ?? null };
    }
  }

  // Exact DB
  const exact = dbExercises.find(e => e.name.toLowerCase() === normalized);
  if (exact) return { matchedName: exact.name, matchedId: exact.id };

  // DB contains
  const contains = dbExercises.find(e =>
    e.name.toLowerCase().includes(normalized) || normalized.includes(e.name.toLowerCase())
  );
  if (contains) return { matchedName: contains.name, matchedId: contains.id };

  // Word overlap
  const rawWords = normalized.split(/\s+/).filter(w => w.length > 2);
  let best = 0, bestEx: typeof dbExercises[0] | null = null;
  for (const ex of dbExercises) {
    const exWords = ex.name.toLowerCase().split(/\s+/);
    const score = rawWords.filter(w => exWords.some(e => e.includes(w) || w.includes(e))).length;
    if (score > best) { best = score; bestEx = ex; }
  }
  if (best >= 1 && bestEx) return { matchedName: bestEx.name, matchedId: bestEx.id };

  // No match — use cleaned name
  return {
    matchedName: cleaned.replace(/\b\w/g, c => c.toUpperCase()) || raw.trim(),
    matchedId: null,
  };
}

// ── SET LINE PARSER ─────────────────────────────────────────────────────────

function parseSetLine(line: string): ParsedSet | null {
  // "N set(s) of WEIGHTxREPS[suffix] for working set (notes)"
  // Handles: (e), (L/R), (each), any parenthetical after reps
  // Weight can be range: 160/170 → takes 160
  const longForm = line.match(
    /\d+\s+sets?\s+of\s+([a-z0-9._\/]+)x([\d.,\/]+)(?:\([^)]*\))?\s+for\s+(?:warmup|working\s+set|work)(.*)/i
  );
  if (longForm) {
    const weight = parseWeight(longForm[1]);
    if (weight === null) return null;
    const reps = parseReps(longForm[2]);
    if (reps <= 0 || reps > 100) return null;
    const tail = longForm[3] ?? '';
    const rpe = parseRPE(tail);
    // Cap RPE at 10 (user sometimes writes "rpe 11" as hyperbole)
    const cappedRpe = rpe !== undefined ? Math.min(rpe, 10) : undefined;
    const note = tail
      .replace(/\(|\)/g, '')
      .replace(/rpe\s*(fail|failure|\d+(?:[-–]\d+)?(?:\.\d+)?)/gi, '')
      .replace(/[,\s]+/g, ' ')
      .trim()
      .slice(0, 120) || undefined;
    return { weight, reps, rpe: cappedRpe, note: note && note.length > 2 ? note : undefined };
  }

  // Short: "225x5", "3.25platesx8", "160/170x10"
  const shortForm = line.trim().match(/^([a-z0-9._\/]+)x([\d.\/,]+)(?:x(\d+))?(?:\([^)]*\))?$/i);
  if (shortForm) {
    const weight = parseWeight(shortForm[1]);
    if (weight === null) return null;
    const reps = parseReps(shortForm[2]);
    if (reps <= 0 || reps > 100) return null;
    return { weight, reps, rpe: parseRPE(line) };
  }

  return null;
}

// ── DATE DETECTION ──────────────────────────────────────────────────────────

const MONTH_NAMES = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

export function detectDate(line: string): Date | null {
  const t = line.trim();

  // MM/DD/YYYY or MM/DD/YY
  const m = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (m) {
    let year = parseInt(m[3]);
    if (year < 100) year += 2000;
    const d = new Date(year, parseInt(m[1]) - 1, parseInt(m[2]));
    if (!isNaN(d.getTime())) return d;
  }

  // "April 2, 2024"
  const l = t.toLowerCase();
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    if (l.startsWith(MONTH_NAMES[i])) {
      const rest = l.slice(MONTH_NAMES[i].length).trim();
      const dm = rest.match(/^\.?\s*(\d{1,2})/);
      if (dm) {
        const ym = rest.match(/(\d{4})/);
        return new Date(ym ? parseInt(ym[1]) : new Date().getFullYear(), i, parseInt(dm[1]));
      }
    }
  }

  return null;
}

// ── LINE CLASSIFIERS ────────────────────────────────────────────────────────

function isBulletExerciseLine(line: string): boolean {
  // Lines starting with bullet chars (after trimming tabs/spaces)
  return /^[\t\s]*[∙•]/.test(line);
}

function isWorkoutHeader(line: string): boolean {
  const t = line.trim();
  // Must NOT start with a digit (rules out set lines)
  if (/^\d/.test(t)) return false;
  // "MON — Upper" / "TUE — Lower (Quad Focus)"
  if (/^(mon|tue|wed|thu|fri|sat|sun)\w*[\s\t]*[—–\-]/i.test(t)) return true;
  // "Upper (Chest Focus)" etc — but only if it's a short line with no set data
  if (/\b(upper|lower|push|pull|leg|chest|back|shoulder|arm)\b/i.test(t) &&
      /\b(focus|day|session)\b/i.test(t) &&
      t.length < 60 &&
      !/\d+\s+set\s+of/i.test(t)) return true;
  return false;
}

function isWarmupLine(line: string): boolean {
  return /for\s+warmup/i.test(line) || /warmup\s+set/i.test(line);
}

function isSkipLine(line: string): boolean {
  const t = line.trim().toLowerCase();
  // Very long lines are journal entries
  if (t.length > 150) return true;
  if (/^(skipped|skip\b|workings?$|workings\s*$)/.test(t)) return true;
  if (/^(core\b|mobility\b|cardio\b|stairmaster|paloff|hollow|kettlebell)/.test(t)) return true;
  if (/^\d+\s+(min|sec|minute|second)/.test(t)) return true;
  if (/^(full\s+\d+|mobility\s+full|✅|deadlift\s+intermission)/.test(t)) return true;
  return false;
}

// ── MAIN PARSER ─────────────────────────────────────────────────────────────

export function parseWorkoutLog(
  text: string,
  dbExercises: { id: string; name: string }[]
): ParsedWorkout[] {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const workouts: ParsedWorkout[] = [];

  let currentWorkout: ParsedWorkout | null = null;
  let currentExercise: ParsedExercise | null = null;
  let pendingDate: Date | null = null;

  const flushExercise = () => {
    if (currentExercise?.sets.length && currentWorkout) {
      currentWorkout.exercises.push(currentExercise);
    }
    currentExercise = null;
  };

  const flushWorkout = () => {
    flushExercise();
    if (currentWorkout?.exercises.length) workouts.push(currentWorkout);
    currentWorkout = null;
  };

  const ensureWorkout = (name: string, date: Date) => {
    if (!currentWorkout) {
      currentWorkout = { name, date, exercises: [] };
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd(); // keep leading tabs for bullet detection
    const trimmed = line.trim();

    if (!trimmed || isSkipLine(trimmed)) continue;

    // ── DATE
    const date = detectDate(trimmed);
    if (date) {
      if (currentWorkout && currentWorkout.date.toDateString() !== date.toDateString()) {
        flushWorkout();
      }
      pendingDate = date;
      continue;
    }

    // ── WORKOUT HEADER ("TUE — Lower...")
    if (isWorkoutHeader(trimmed)) {
      flushWorkout();
      currentWorkout = {
        name: trimmed.replace(/^(mon|tue|wed|thu|fri|sat|sun)\w*[\s\t]*[—–\-]+\s*/i, '').trim() || trimmed,
        date: pendingDate ?? new Date(),
        exercises: [],
      };
      pendingDate = null;
      continue;
    }

    // ── BULLET EXERCISE LINE (∙ Bulgarian Split Squat — 4×8-10)
    // Always treat bullet lines as exercise headers — NEVER as set data
    if (isBulletExerciseLine(line)) {
      flushExercise();
      ensureWorkout('Imported Workout', pendingDate ?? new Date());
      const match = matchExerciseName(trimmed, dbExercises);
      currentExercise = { rawName: trimmed, ...match, sets: [] };
      continue;
    }

    // ── WARMUP — skip
    if (isWarmupLine(trimmed)) continue;

    // ── SET LINE
    const parsed = parseSetLine(trimmed);
    if (parsed) {
      ensureWorkout('Imported Workout', pendingDate ?? new Date());
      if (!currentExercise) {
        // Set without an exercise header — create a placeholder
        currentExercise = { rawName: '', matchedName: 'Unknown', matchedId: null, sets: [] };
      }
      currentExercise.sets.push(parsed);
      continue;
    }

    // ── PLAIN EXERCISE NAME (no bullet, no set data, short line)
    if (trimmed.length < 60 && /^[a-zA-Z]/.test(trimmed) && !/\d+\s+set\s+of/i.test(trimmed)) {
      flushExercise();
      ensureWorkout('Imported Workout', pendingDate ?? new Date());
      const match = matchExerciseName(trimmed, dbExercises);
      currentExercise = { rawName: trimmed, ...match, sets: [] };
    }
  }

  flushWorkout();
  return workouts;
}

// ── HEVY CSV PARSER ──────────────────────────────────────────────────────────
// Hevy export format:
// Title,Start Time,End Time,Duration,Notes
// Exercise Name,Set Order,Weight (lbs),Reps,Distance (miles),Duration (seconds),Notes
//
// Liftoff / Strong CSV is similar enough to reuse the same parser

export function isHevyCSV(text: string): boolean {
  const firstLine = text.split('\n')[0]?.toLowerCase() ?? '';
  return firstLine.includes('title') && firstLine.includes('start time') ||
    firstLine.includes('exercise name') && firstLine.includes('set order') ||
    firstLine.includes('workout name') && firstLine.includes('exercise name');
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

export function parseHevyCSV(
  csv: string,
  dbExercises: { id: string; name: string }[]
): ParsedWorkout[] {
  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, '_'));

  // Find column indices
  const col = (names: string[]) => {
    for (const n of names) {
      const idx = headers.findIndex(h => h.includes(n));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const titleIdx    = col(['title', 'workout_name', 'workout name']);
  const startIdx    = col(['start_time', 'date']);
  const exNameIdx   = col(['exercise_name', 'exercise_title']);
  const weightIdx   = col(['weight']);
  const repsIdx     = col(['reps']);
  const rpeIdx      = col(['rpe']);
  const noteIdx     = col(['notes', 'note']);

  if (exNameIdx < 0 || weightIdx < 0 || repsIdx < 0) return [];

  const workoutMap = new Map<string, ParsedWorkout>();
  const exerciseMap = new Map<string, ParsedExercise>(); // key: workoutKey + exName

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 3) continue;

    const workoutTitle = titleIdx >= 0 ? cols[titleIdx] : 'Imported Workout';
    const startRaw = startIdx >= 0 ? cols[startIdx] : '';
    const exName = exNameIdx >= 0 ? cols[exNameIdx] : '';
    const weightRaw = weightIdx >= 0 ? cols[weightIdx] : '0';
    const repsRaw = repsIdx >= 0 ? cols[repsIdx] : '0';
    const rpeRaw = rpeIdx >= 0 ? cols[rpeIdx] : '';
    const noteRaw = noteIdx >= 0 ? cols[noteIdx] : '';

    if (!exName || !workoutTitle) continue;

    // Parse date
    let date = new Date();
    if (startRaw) {
      const d = new Date(startRaw);
      if (!isNaN(d.getTime())) date = d;
    }

    const workoutKey = `${workoutTitle}__${date.toDateString()}`;

    if (!workoutMap.has(workoutKey)) {
      workoutMap.set(workoutKey, { name: workoutTitle, date, exercises: [] });
    }
    const workout = workoutMap.get(workoutKey)!;

    const exKey = `${workoutKey}__${exName}`;
    if (!exerciseMap.has(exKey)) {
      const match = matchExerciseName(exName, dbExercises);
      const ex: ParsedExercise = { rawName: exName, ...match, sets: [] };
      exerciseMap.set(exKey, ex);
      workout.exercises.push(ex);
    }
    const exercise = exerciseMap.get(exKey)!;

    const weight = parseFloat(weightRaw) || 0;
    const reps = parseInt(repsRaw) || 0;
    const rpe = rpeRaw ? parseFloat(rpeRaw) : undefined;

    if (reps > 0) {
      exercise.sets.push({
        weight,
        reps,
        rpe: rpe && rpe >= 1 && rpe <= 10 ? rpe : undefined,
        note: noteRaw || undefined,
      });
    }
  }

  return Array.from(workoutMap.values()).filter(w => w.exercises.length > 0);
}

// ── SMART ENTRY POINT — detects format automatically ────────────────────────

export function parseAnyFormat(
  text: string,
  dbExercises: { id: string; name: string }[]
): ParsedWorkout[] {
  if (isHevyCSV(text)) return parseHevyCSV(text, dbExercises);
  return parseWorkoutLog(text, dbExercises);
}
