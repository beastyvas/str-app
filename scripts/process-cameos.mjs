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
  // The model files ship inside the package; point at scripts/node_modules
  // explicitly (by default it resolves against the CWD's node_modules).
  const dist = path.join(ROOT, 'scripts/node_modules/@imgly/background-removal-node/dist/');
  const blob = await removeBackground(new Blob([buf], { type: 'image/png' }), {
    publicPath: `file://${dist}`,
    model: 'medium',
    output: { format: 'image/png' },
  });
  return Buffer.from(await blob.arrayBuffer());
}

/**
 * Flat-background remover: flood-fills from the image border through pixels
 * close to the border color, with a soft edge. Fast, deterministic, and right
 * for generated art on a plain background. Returns null when the border isn't
 * flat (busy photo / wallpaper) so the ML remover takes over.
 */
async function floodCutout(buf, tol = 30) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = (x, y) => (y * w + x) * 4;
  const border = [];
  for (let x = 0; x < w; x += 4) border.push(px(x, 0), px(x, h - 1));
  for (let y = 0; y < h; y += 4) border.push(px(0, y), px(w - 1, y));
  const med = c => border.map(i => data[i + c]).sort((a, b) => a - b)[border.length >> 1];
  const bg = [med(0), med(1), med(2)];
  const dist = i => Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);
  const flat = border.filter(i => dist(i) < tol).length / border.length;
  if (flat < 0.6) return null;

  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => { const k = y * w + x; if (!seen[k] && dist(k * 4) < tol) { seen[k] = 1; stack.push(k); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const k = stack.pop(); const x = k % w; const y = (k / w) | 0;
    if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1);
  }
  for (let k = 0; k < w * h; k++) {
    if (seen[k]) { data[k * 4 + 3] = 0; continue; }
    // Soft edge: pixels touching the background fade by how close they are to it
    const x = k % w; const y = (k / w) | 0;
    const edge = (x > 0 && seen[k - 1]) || (x < w - 1 && seen[k + 1]) || (y > 0 && seen[k - w]) || (y < h - 1 && seen[k + w]);
    if (edge) data[k * 4 + 3] = Math.round(255 * Math.min(1, dist(k * 4) / (tol * 2.2)));
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
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
    const flat = await floodCutout(buf);
    if (flat) { process.stdout.write('flat background removed… '); buf = flat; }
    else { process.stdout.write('removing background (ML)… '); buf = await cutout(buf); }
  }

  // Trim empty space, then fit the WHOLE character inside 600×800 (never
  // crop a head or hands off), anchored to the bottom edge since cameos peek
  // up from the bottom of the screen.
  buf = await sharp(buf).trim({ threshold: 10 }).toBuffer();
  buf = await sharp(buf)
    .resize({ width: W, height: H, fit: 'contain', position: 'bottom', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
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
