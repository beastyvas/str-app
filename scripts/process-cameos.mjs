// Drop raw images in assets/cameos/_inbox/ named <id>.<ext> or <id>-hype.<ext>
// (gojo.jpg, gojo-hype.png, allmight.webp), then:
//   node scripts/process-cameos.mjs
// For each file: remove background (skipped if it already has transparency),
// trim, crop to 600×800 with the face in the upper third, optional flip from
// manifest.json, compress under 300 KB, write <id>/portrait.png or hype.png,
// move the raw into _inbox/done/, resync the registry, write _preview.html.
//
// One-time setup (kept out of the app's package.json so EAS never installs
// onnxruntime): npm --prefix scripts install
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import {
  CAMEOS, CAST, IDS, PLACEHOLDERS_FILE, ROOT, WORLD_AURA, WORLD_NAME, WORLD_ORDER, readJSON, sha1, worldOf,
} from './cast-lib.mjs';

const INBOX = path.join(CAMEOS, '_inbox');
const DONE = path.join(INBOX, 'done');
const MANIFEST = path.join(CAMEOS, 'manifest.json');
const W = 600, H = 800, MAX_BYTES = 300 * 1024;
const EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.tif', '.tiff', '.heic']);

fs.mkdirSync(DONE, { recursive: true });
const manifest = readJSON(MANIFEST, {});
const placeholders = readJSON(PLACEHOLDERS_FILE, {});

const files = fs.readdirSync(INBOX).filter(f => EXTS.has(path.extname(f).toLowerCase()));
if (!files.length) {
  console.log(`Nothing in ${path.relative(ROOT, INBOX)}/. Drop <id>.jpg or <id>-hype.png there.`);
}

// Validate every name before touching anything.
const jobs = files.map(f => {
  const base = path.basename(f, path.extname(f)).toLowerCase();
  const hype = base.endsWith('-hype');
  const id = hype ? base.slice(0, -5) : base;
  return { f, base, id, hype };
});
const unknown = jobs.filter(j => !IDS.includes(j.id));
if (unknown.length) {
  console.error(`Unknown character id(s): ${unknown.map(j => j.f).join(', ')}`);
  console.error(`Valid ids:\n  ${IDS.join(', ')}\n(append -hype for the powered-up variant)`);
  process.exit(1);
}

let removeBackground = null;
async function cutout(buf) {
  if (!removeBackground) {
    try {
      ({ removeBackground } = await import('@imgly/background-removal-node'));
    } catch {
      console.error('Background removal needs a one-time install: npm --prefix scripts install');
      process.exit(1);
    }
  }
  const blob = await removeBackground(new Blob([buf], { type: 'image/png' }));
  return Buffer.from(await blob.arrayBuffer());
}

async function hasTransparency(buf) {
  const img = sharp(buf);
  const meta = await img.metadata();
  if (!meta.hasAlpha) return false;
  const { channels } = await img.stats();
  return channels[3] && channels[3].min < 250;
}

for (const job of jobs) {
  const src = path.join(INBOX, job.f);
  process.stdout.write(`${job.f} → `);
  let buf = await sharp(src).rotate().png().toBuffer();

  if (!(await hasTransparency(buf))) {
    process.stdout.write('removing background… ');
    buf = await cutout(buf);
  }

  // Trim empty space, then fit to 600×800. `attention` crops toward the most
  // salient region (usually the face) when the aspect doesn't match; then the
  // canvas pads so the character sits in the upper part of the frame.
  buf = await sharp(buf).trim({ threshold: 10 }).toBuffer();
  const fitted = await sharp(buf)
    .resize({ width: W, height: Math.round(H * 0.94), fit: 'cover', position: sharp.strategy.attention })
    .toBuffer();
  let out = sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, top: Math.round(H * 0.06), left: 0 }]);
  buf = await out.png().toBuffer();
  if (manifest[job.base]?.flip) buf = await sharp(buf).flop().toBuffer();

  // Compress: palette PNG, stepping quality down until under 300 KB.
  let png;
  for (const q of [80, 70, 60, 50, 40]) {
    png = await sharp(buf).png({ palette: true, quality: q, compressionLevel: 9, effort: 10 }).toBuffer();
    if (png.length <= MAX_BYTES) break;
  }

  const dir = path.join(CAMEOS, job.id);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, job.hype ? 'hype.png' : 'portrait.png');
  fs.writeFileSync(dest, png);
  if (!job.hype) delete placeholders[job.id]; // real art now
  fs.renameSync(src, path.join(DONE, job.f));
  if (!(job.base in manifest)) manifest[job.base] = { flip: false };
  console.log(`${path.relative(ROOT, dest)} (${Math.round(png.length / 1024)} KB)`);
}

fs.writeFileSync(PLACEHOLDERS_FILE, JSON.stringify(placeholders, null, 1) + '\n');
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
execFileSync(process.execPath, [path.join(ROOT, 'scripts/sync-cameo-registry.mjs')], { stdio: 'inherit' });

// Contact sheet: every character in its world, on Ink Night, at the in-app
// 180pt peek size, with a facing guide (characters should face LEFT).
const card = c => {
  const dir = path.join(CAMEOS, c.id);
  const ph = placeholders[c.id] === sha1(path.join(dir, 'portrait.png'));
  const hype = fs.existsSync(path.join(dir, 'hype.png'));
  return `<figure><div class="peek"><img src="${c.id}/portrait.png?${Date.now()}"></div>
    ${hype ? `<div class="peek"><img src="${c.id}/hype.png?${Date.now()}"></div>` : ''}
    <figcaption style="color:${c.bubbleColor}">${c.name}</figcaption>
    <small>${c.id}${ph ? ' · placeholder' : ''}${hype ? ' · +hype' : ''}</small></figure>`;
};
const html = `<!doctype html><meta charset="utf-8"><title>STR cast preview</title>
<style>
 body{background:#0C0E1A;color:#EEF0FA;font:14px -apple-system,system-ui,sans-serif;margin:24px}
 h2{margin:32px 0 12px;font-weight:700} .grid{display:flex;flex-wrap:wrap;gap:16px}
 figure{margin:0;display:flex;flex-direction:column;gap:4px;align-items:flex-start}
 .peek{width:135px;height:180px;background:#151829;border:1px solid #262B44;position:relative;overflow:hidden}
 .peek::after{content:'← face this way';position:absolute;bottom:4px;left:4px;font-size:10px;color:#5D6283}
 .peek img{width:100%;height:100%;object-fit:contain} figcaption{font-weight:700} small{color:#9096B4}
</style>
<h1>Cast preview</h1><p>Generated by scripts/process-cameos.mjs. Wrong facing? Set <code>"flip": true</code> in manifest.json and re-drop the file.</p>
${WORLD_ORDER.map(w => `<h2 style="color:${WORLD_AURA[w]}">${WORLD_NAME[w]}</h2><div class="grid">${CAST.filter(c => worldOf(c) === w).map(card).join('')}</div>`).join('')}`;
fs.writeFileSync(path.join(CAMEOS, '_preview.html'), html);
console.log(`Preview: ${path.relative(ROOT, path.join(CAMEOS, '_preview.html'))}`);
