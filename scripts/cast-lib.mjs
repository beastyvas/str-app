// Shared helpers for the cameo asset scripts. Cast metadata comes from the
// app's own source of truth (src/constants/castData.json).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CAMEOS = path.join(ROOT, 'assets', 'cameos');
export const CAST = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/constants/castData.json'), 'utf8'));
export const IDS = CAST.map(c => c.id);
export const PLACEHOLDERS_FILE = path.join(CAMEOS, 'placeholders.json');

// Mirrors src/theme/worlds/palette.ts — aura per world; guests use neutral.
export const WORLD_AURA = {
  mortal: '#F97316', awakened: '#EF4444', ascendant: '#818CF8',
  phantom: '#38BDF8', sovereign: '#A78BFA', godhand: '#FBBF24', guest: '#9096B4',
};
export const WORLD_ORDER = ['mortal', 'awakened', 'ascendant', 'phantom', 'sovereign', 'godhand', 'guest'];
export const WORLD_NAME = {
  mortal: 'Mortal · Demon Slayer', awakened: 'Awakened · My Hero Academia',
  ascendant: 'Ascendant · Jujutsu Kaisen', phantom: 'Phantom · Dragon Ball',
  sovereign: 'Sovereign · Solo Leveling', godhand: 'Godhand · One Punch Man', guest: 'Guests',
};

export const sha1 = file => crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
export const readJSON = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
export const worldOf = c => c.tier ?? 'guest';
