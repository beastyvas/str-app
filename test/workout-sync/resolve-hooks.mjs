// Maps the app's "@/" alias and its native-only deps onto stubs, so the real
// useWorkout store can be exercised under plain node. Node 22 strips the TS
// types itself, so there is no build step and no test framework to maintain.
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolvePath(HERE, '..', '..') + '/';
const STUBS = new URL('./stubs/', import.meta.url).href;

const MAP = {
  '@/lib/supabase': STUBS + 'supabase.mjs',
  'expo-crypto': STUBS + 'expo-crypto.mjs',
  '@react-native-async-storage/async-storage': STUBS + 'async-storage.mjs',
};

const withExt = base => {
  for (const e of ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx']) {
    if (existsSync(base + e)) return base + e;
  }
  return base;
};

export async function resolve(specifier, context, next) {
  if (MAP[specifier]) return { url: MAP[specifier], shortCircuit: true };
  if (specifier.startsWith('@/')) {
    return { url: pathToFileURL(withExt(ROOT + 'src/' + specifier.slice(2))).href, shortCircuit: true };
  }
  return next(specifier, context);
}
