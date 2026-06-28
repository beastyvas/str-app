// Basic objectionable-content screen for user-submitted text (display names,
// notes, comments, bios). This is a first-line client-side filter to satisfy
// App Store Guideline 1.2 — it is intentionally simple and conservative, not a
// substitute for the server-side report/block moderation flow.

// Common profanity / slur stems. Matched case-insensitively against normalized
// text. Kept deliberately short and focused on clearly objectionable terms.
const BLOCKLIST = [
  'fuck', 'shit', 'bitch', 'cunt', 'asshole', 'dickhead', 'motherfucker',
  'bastard', 'slut', 'whore', 'faggot', 'fag', 'nigger', 'nigga', 'retard',
  'kike', 'spic', 'chink', 'wetback', 'tranny', 'rape', 'rapist', 'pedophile',
  'pedo', 'molest', 'nazi',
];

// Normalize leetspeak / spacing tricks so "f.u.c.k" or "sh1t" still trip.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s._\-*]+/g, '')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's');
}

/**
 * Returns true if the text contains clearly objectionable language.
 */
export function containsObjectionable(text: string | null | undefined): boolean {
  if (!text) return false;
  const normalized = normalize(text);
  return BLOCKLIST.some(word => normalized.includes(word));
}

/**
 * Validates a user-submitted text field. Returns an error message if the text
 * is objectionable, or null if it's clean.
 */
export function screenText(
  text: string | null | undefined,
  fieldLabel = 'text',
): string | null {
  if (containsObjectionable(text)) {
    return `That ${fieldLabel} contains language that isn't allowed. STR has zero tolerance for objectionable content — please revise it.`;
  }
  return null;
}

/**
 * Masks objectionable words with asterisks for display (used when rendering
 * content we can't reject outright, e.g. legacy data).
 */
export function maskProfanity(text: string): string {
  let out = text;
  for (const word of BLOCKLIST) {
    const re = new RegExp(word, 'gi');
    out = out.replace(re, m => m[0] + '*'.repeat(Math.max(1, m.length - 1)));
  }
  return out;
}
