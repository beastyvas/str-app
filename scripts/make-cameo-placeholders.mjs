// Writes a plain placeholder portrait.png for every cast member that doesn't
// have one yet: 600×800 transparent PNG, a solid circle in the world's aura
// with the character's initials in white. Deliberately resembles nobody.
// Never overwrites real art. Run: node scripts/make-cameo-placeholders.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { CAMEOS, CAST, PLACEHOLDERS_FILE, WORLD_AURA, readJSON, sha1, worldOf } from './cast-lib.mjs';

const initials = name => name.split(/[\s-]+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();

const placeholders = readJSON(PLACEHOLDERS_FILE, {});
let made = 0;
for (const c of CAST) {
  const dir = path.join(CAMEOS, c.id);
  const file = path.join(dir, 'portrait.png');
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(file) && placeholders[c.id] !== sha1(file)) continue; // real art — leave it
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800">
    <circle cx="300" cy="330" r="230" fill="${WORLD_AURA[worldOf(c)]}"/>
    <text x="300" y="392" font-family="Helvetica, Arial, sans-serif" font-size="170" font-weight="700"
      fill="#FFFFFF" text-anchor="middle">${initials(c.name)}</text>
  </svg>`;
  await sharp(Buffer.from(svg)).png({ palette: true, compressionLevel: 9 }).toFile(file);
  placeholders[c.id] = sha1(file);
  made++;
}
fs.writeFileSync(PLACEHOLDERS_FILE, JSON.stringify(placeholders, null, 1) + '\n');
console.log(`Placeholders written: ${made}. Now run: node scripts/sync-cameo-registry.mjs`);
