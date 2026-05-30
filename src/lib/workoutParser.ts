// Workout log parser — handles common Google Docs / notes formats
// No AI required. Regex-based, fast, free.

export interface ParsedSet {
  weight: number;
  reps: number;
  rpe?: number;
  note?: string;
}

export interface ParsedExercise {
  rawName: string;       // what was in the log
  matchedName: string;   // matched DB name (or rawName if no match)
  matchedId: string | null;
  sets: ParsedSet[];
}

export interface ParsedWorkout {
  name: string;
  date: Date;
  exercises: ParsedExercise[];
}

// ── ABBREVIATION DICTIONARY ────────────────────────────────────────────────
const ABBREV: Record<string, string> = {
  // Chest
  'bp': 'Barbell Bench Press',
  'bench': 'Barbell Bench Press',
  'bench press': 'Barbell Bench Press',
  'flat bench': 'Barbell Bench Press',
  'incline bench': 'Incline Barbell Bench Press',
  'incline bp': 'Incline Barbell Bench Press',
  'incline press': 'Incline Barbell Bench Press',
  'db bench': 'Dumbbell Bench Press',
  'dumbbell bench': 'Dumbbell Bench Press',
  'db press': 'Dumbbell Bench Press',
  'incline db': 'Incline Dumbbell Press',
  'dips': 'Dips',
  'pec deck': 'Pec Deck Cable Flys',
  'cable flys': 'Pec Deck Cable Flys',
  'flyes': 'Pec Deck Cable Flys',
  // Shoulders
  'ohp': 'Overhead Press',
  'overhead press': 'Overhead Press',
  'military press': 'Overhead Press',
  'db shoulder press': 'Dumbbell Shoulder Press',
  'db ohp': 'Dumbbell Shoulder Press',
  'lateral raise': 'Dumbbell Lateral Raise',
  'laterals': 'Dumbbell Lateral Raise',
  'lat raise': 'Dumbbell Lateral Raise',
  'cable lateral': 'Cable Lateral Raise',
  'rear delt': 'Rear Delt Fly',
  'face pull': 'Face Pulls',
  'face pulls': 'Face Pulls',
  // Back
  'pullup': 'Pullups',
  'pullups': 'Pullups',
  'pull up': 'Pullups',
  'pull ups': 'Pullups',
  'chinup': 'Pullups',
  'chinups': 'Pullups',
  'lat pulldown': 'Lat Pulldowns',
  'lat pulldowns': 'Lat Pulldowns',
  'pulldown': 'Lat Pulldowns',
  'pulldowns': 'Lat Pulldowns',
  'bb row': 'Barbell Row',
  'barbell row': 'Barbell Row',
  'bent over row': 'Barbell Row',
  'pendlay': 'Pendlay Row',
  'pendlay row': 'Pendlay Row',
  't-bar': 'T-Bar Row',
  'tbar': 'T-Bar Row',
  't bar row': 'T-Bar Row',
  'cable row': 'Seated Cable Row',
  'seated row': 'Seated Cable Row',
  // Biceps
  'curl': 'Bicep Curl',
  'curls': 'Bicep Curl',
  'bb curl': 'Bicep Curl',
  'barbell curl': 'Bicep Curl',
  'db curl': 'Bicep Curl',
  'hammer curl': 'Hammer Curl',
  'hammer curls': 'Hammer Curl',
  'preacher curl': 'Preacher Curl',
  'preacher curls': 'Preacher Curl',
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
  'close grip bench': 'Close Grip Bench Press',
  'tricep pushdown': 'Overhand Pushdowns',
  'pushdowns': 'Overhand Pushdowns',
  'pushdown': 'Overhand Pushdowns',
  'cable extension': 'Standing Cable Extension',
  'tricep extension': 'Standing Cable Extension',
  'katana': 'Katana Extensions',
  'kickback': 'Cable Kickback',
  // Legs
  'squat': 'Barbell Back Squats',
  'squats': 'Barbell Back Squats',
  'back squat': 'Barbell Back Squats',
  'back squats': 'Barbell Back Squats',
  'bb squat': 'Barbell Back Squats',
  'hack squat': 'Hack Squats',
  'hack squats': 'Hack Squats',
  'leg press': 'Leg Press',
  'leg extension': 'Leg Extensions',
  'leg extensions': 'Leg Extensions',
  'leg curl': 'Leg Curl',
  'leg curls': 'Leg Curl',
  'rdl': 'Barbell RDLs',
  'romanian deadlift': 'Barbell RDLs',
  'romanian dl': 'Barbell RDLs',
  'db rdl': 'Dumbbell RDLs',
  'good morning': 'Good Mornings',
  'good mornings': 'Good Mornings',
  'goblet squat': 'Goblet Squats',
  'goblet squats': 'Goblet Squats',
  'bss': 'Bulgarian Split Squat',
  'bulgarian': 'Bulgarian Split Squat',
  'split squat': 'Bulgarian Split Squat',
  'lunges': 'Walking Lunges',
  'walking lunge': 'Walking Lunges',
  'reverse lunge': 'Reverse Lunges',
  'step up': 'Dumbbell Step-Ups',
  'step ups': 'Dumbbell Step-Ups',
  // Glutes
  'hip thrust': 'Hip Thrust',
  'hip thrusts': 'Hip Thrust',
  'glute bridge': 'KAS Glute Bridge',
  'kas': 'KAS Glute Bridge',
  'back extension': 'Glute Focused Back Extension',
  // Deadlifts
  'dl': 'Deadlifts',
  'deadlift': 'Deadlifts',
  'deadlifts': 'Deadlifts',
  'conventional': 'Deadlifts',
  'sumo': 'Deadlifts',
};

// ── MATCHERS ───────────────────────────────────────────────────────────────

export function matchExerciseName(
  raw: string,
  dbExercises: { id: string; name: string }[]
): { matchedName: string; matchedId: string | null } {
  const normalized = raw.toLowerCase().trim().replace(/[^a-z0-9 \-]/g, '');

  // 1. Exact abbreviation match
  if (ABBREV[normalized]) {
    const abbrevName = ABBREV[normalized];
    const db = dbExercises.find(e => e.name.toLowerCase() === abbrevName.toLowerCase());
    return { matchedName: abbrevName, matchedId: db?.id ?? null };
  }

  // 2. Exact DB match
  const exact = dbExercises.find(e => e.name.toLowerCase() === normalized);
  if (exact) return { matchedName: exact.name, matchedId: exact.id };

  // 3. DB contains match
  const contains = dbExercises.find(e =>
    e.name.toLowerCase().includes(normalized) || normalized.includes(e.name.toLowerCase())
  );
  if (contains) return { matchedName: contains.name, matchedId: contains.id };

  // 4. Word overlap — score by how many words match
  const rawWords = normalized.split(' ').filter(w => w.length > 2);
  let bestScore = 0;
  let bestMatch = null;
  for (const ex of dbExercises) {
    const exWords = ex.name.toLowerCase().split(' ');
    const overlap = rawWords.filter(w => exWords.some(e => e.includes(w) || w.includes(e))).length;
    if (overlap > bestScore) { bestScore = overlap; bestMatch = ex; }
  }
  if (bestScore >= 1 && bestMatch) return { matchedName: bestMatch.name, matchedId: bestMatch.id };

  // No match — use raw name, create as custom later
  const titleCase = raw.trim().replace(/\b\w/g, c => c.toUpperCase());
  return { matchedName: titleCase, matchedId: null };
}

// ── SET PARSERS ────────────────────────────────────────────────────────────

// Parse RPE from string: @8, rpe8, (8.5), rpe 8
function extractRPE(str: string): number | undefined {
  const m = str.match(/(?:@|rpe\s*|r\s*)(\d+(?:\.\d+)?)/i);
  if (!m) return undefined;
  const v = parseFloat(m[1]);
  return v >= 1 && v <= 10 ? v : undefined;
}

// Extract trailing note (anything after RPE / numbers that looks like text)
function extractNote(str: string): string | undefined {
  const cleaned = str.replace(/(?:@|rpe\s*)[\d.]+/gi, '').replace(/[\d.,x×\s\/\-]+/g, ' ').trim();
  return cleaned.length > 2 ? cleaned : undefined;
}

// Parse "225x5", "225 x 5", "225/5", "225 5"
function parseSingleSet(token: string): ParsedSet | null {
  token = token.trim();

  // WEIGHTxREPSxSETS (e.g. 225x5x3) — expand into N sets
  // Handled at call site, not here

  // WEIGHTxREPS or WEIGHT/REPS or "WEIGHT REPS"
  const m = token.match(/^(\d+(?:\.\d+)?)\s*[x×\/\s]\s*(\d+)(?:\s*[x×]\s*(\d+))?/i);
  if (!m) return null;

  const weight = parseFloat(m[1]);
  const reps = parseInt(m[2]);
  const rpe = extractRPE(token);

  if (weight <= 0 || reps <= 0 || reps > 100) return null;
  return { weight, reps, rpe };
}

// Parse all sets from a set string like "225x5, 235x4, 235x4" or "225x5x3"
export function parseSetsFromString(raw: string): ParsedSet[] {
  const rpe = extractRPE(raw);
  const note = extractNote(raw);
  const sets: ParsedSet[] = [];

  // Remove RPE token for cleaner parsing
  const cleaned = raw.replace(/(?:@|rpe\s*)[\d.]+/gi, '').trim();

  // Split on commas, semicolons, or " / "
  const tokens = cleaned.split(/[,;]|\s+\/\s+/).map(t => t.trim()).filter(Boolean);

  for (const token of tokens) {
    // Check for WEIGHTxREPSxSETS (3rd number = set count)
    const tripleMatch = token.match(/^(\d+(?:\.\d+)?)\s*[x×]\s*(\d+)\s*[x×]\s*(\d+)$/i);
    if (tripleMatch) {
      const weight = parseFloat(tripleMatch[1]);
      const reps = parseInt(tripleMatch[2]);
      const numSets = parseInt(tripleMatch[3]);
      if (weight > 0 && reps > 0 && numSets > 0 && numSets <= 20) {
        for (let i = 0; i < numSets; i++) {
          sets.push({ weight, reps, rpe, note: i === 0 ? note : undefined });
        }
        continue;
      }
    }

    // Check for SETSxREPS@WEIGHT (e.g. "3x5 @225")
    const altMatch = token.match(/^(\d+)\s*[x×]\s*(\d+)\s*$/);
    if (altMatch && rpe === undefined) {
      // Could be SETSxREPS or WEIGHTxREPS — weight is usually > 30
      const a = parseInt(altMatch[1]);
      const b = parseInt(altMatch[2]);
      if (a <= 10 && b <= 30) {
        // Looks like SETSxREPS — but we need the weight from elsewhere
        // Skip for now, let standard parser handle
      }
    }

    const s = parseSingleSet(token);
    if (s) sets.push({ ...s, note: sets.length === 0 ? note : undefined });
  }

  return sets;
}

// ── DATE DETECTION ─────────────────────────────────────────────────────────

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
              'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function detectDate(line: string): Date | null {
  const l = line.toLowerCase().trim();

  // Pure date patterns: 4/2/24, 4-2-2024, 4.2.24
  const numericDate = line.match(/^(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/);
  if (numericDate) {
    const month = parseInt(numericDate[1]) - 1;
    const day = parseInt(numericDate[2]);
    let year = numericDate[3] ? parseInt(numericDate[3]) : new Date().getFullYear();
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime()) && month >= 0 && month <= 11 && day >= 1 && day <= 31) return d;
  }

  // "April 2", "April 2, 2024"
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

  // Lines starting with day name that also have a date
  for (const day of DAYS) {
    if (l.startsWith(day)) {
      // Try to find a date after the day name
      const rest = line.slice(day.length);
      const embedded = rest.match(/(\d{1,2})[\/\-\.](\d{1,2})/);
      if (embedded) {
        const month = parseInt(embedded[1]) - 1;
        const d = parseInt(embedded[2]);
        return new Date(new Date().getFullYear(), month, d);
      }
      // Just a day name — use current week's date for that day
      const dayIndex = DAYS.indexOf(day) % 7;
      const now = new Date();
      const diff = dayIndex - now.getDay();
      const date = new Date(now);
      date.setDate(now.getDate() + diff - (diff > 0 ? 7 : 0));
      return date;
    }
  }

  return null;
}

// ── EXERCISE LINE DETECTION ────────────────────────────────────────────────

// A line is an exercise header if it has mostly words and few/no numbers
function isExerciseLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 2) return false;

  // Lines with only numbers and x/× are set lines
  if (/^[\d\s.,x×\/\-@()]+$/.test(trimmed)) return false;

  // Has at least one letter word of length > 1
  const words = trimmed.split(/\s+/);
  const letterWords = words.filter(w => /[a-zA-Z]{2,}/.test(w));
  if (letterWords.length === 0) return false;

  // If it's mostly letters with maybe a colon at end — exercise name
  const strippedColon = trimmed.replace(/:$/, '');
  const letterRatio = strippedColon.replace(/[^a-zA-Z\s]/g, '').length / strippedColon.length;
  return letterRatio > 0.5;
}

// A line has set data
function hasSetData(line: string): boolean {
  return /\d+\s*[x×\/]\s*\d+/.test(line) || /^\d+\s+\d+/.test(line.trim());
}

// ── MAIN PARSER ────────────────────────────────────────────────────────────

export function parseWorkoutLog(
  text: string,
  dbExercises: { id: string; name: string }[]
): ParsedWorkout[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const workouts: ParsedWorkout[] = [];

  let currentWorkout: ParsedWorkout | null = null;
  let currentExercise: ParsedExercise | null = null;
  let pendingExerciseName: string | null = null;

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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ── DATE LINE → new workout
    const date = detectDate(line);
    if (date) {
      flushWorkout();
      currentWorkout = {
        name: line.trim().replace(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*/i, '').trim() || line.trim(),
        date,
        exercises: [],
      };
      pendingExerciseName = null;
      continue;
    }

    // If no current workout, create a placeholder
    if (!currentWorkout) {
      currentWorkout = {
        name: 'Imported Workout',
        date: new Date(),
        exercises: [],
      };
    }

    // ── EXERCISE NAME + SETS ON SAME LINE
    // "Bench Press: 225x5, 235x4" or "Bench 225x5 235x4"
    const colonSplit = line.match(/^([a-zA-Z][a-zA-Z\s\-\']{2,30}?)[:]\s*(.+)/);
    if (colonSplit) {
      const namePart = colonSplit[1].trim();
      const setsPart = colonSplit[2].trim();
      if (hasSetData(setsPart)) {
        flushExercise();
        const match = matchExerciseName(namePart, dbExercises);
        const sets = parseSetsFromString(setsPart);
        if (sets.length > 0) {
          currentExercise = { rawName: namePart, ...match, sets };
          flushExercise();
        }
        continue;
      }
    }

    // ── PURE EXERCISE NAME LINE (no sets data)
    if (isExerciseLine(line) && !hasSetData(line)) {
      flushExercise();
      pendingExerciseName = line.replace(/:$/, '').trim();
      currentExercise = null;
      continue;
    }

    // ── SET DATA LINE
    if (hasSetData(line)) {
      const sets = parseSetsFromString(line);
      if (sets.length > 0) {
        if (!currentExercise) {
          // Use pending exercise name, or try to parse name from this line
          const namePart = pendingExerciseName ?? 'Unknown Exercise';
          const match = matchExerciseName(namePart, dbExercises);
          currentExercise = { rawName: namePart, ...match, sets: [] };
          pendingExerciseName = null;
        }
        currentExercise.sets.push(...sets);
      }
      continue;
    }

    // ── EXERCISE + SETS ON SAME LINE (no colon)
    // "Bench Press 225x5 235x4" — split at first number
    const noColonSplit = line.match(/^([a-zA-Z][a-zA-Z\s\-\']{2,30}?)\s+((?:\d[\d\s.,x×\/]*)+(?:@[\d.]+)?)/);
    if (noColonSplit) {
      const namePart = noColonSplit[1].trim();
      const setsPart = noColonSplit[2].trim();
      if (hasSetData(setsPart) && isExerciseLine(namePart)) {
        flushExercise();
        const match = matchExerciseName(namePart, dbExercises);
        const sets = parseSetsFromString(setsPart);
        if (sets.length > 0) {
          currentExercise = { rawName: namePart, ...match, sets };
          flushExercise();
        }
        continue;
      }
    }
  }

  flushWorkout();
  return workouts;
}
