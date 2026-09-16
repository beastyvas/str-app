import assert from 'node:assert/strict';
import { useWorkoutStore } from '@/hooks/useWorkout';
import { db, resetDb } from './stubs/supabase.mjs';

const S = () => useWorkoutStore.getState();
const EX = { id: 'ex-bench', name: 'Barbell Bench Press', muscle_group: 'chest' };
let pass = 0, fail = 0;
const t = (name, fn) => fn().then(
  () => { console.log(`  ok   ${name}`); pass++; },
  e => { console.log(`  FAIL ${name}\n       ${e.message}`); fail++; });

async function fresh({ latencyMs = 0 } = {}) {
  resetDb();
  useWorkoutStore.setState({ activeWorkout: null, newPRs: [], syncFailed: false });
  await S().startWorkout('Push', 'user-1');
  S().addExercise(EX);
  db.latencyMs = latencyMs;
}

console.log('\nsync-chain / commit-path behaviour\n');

// THE REGRESSION TEST. Five rapid ✓ taps on a slow link must yield five rows.
await t('5 rapid logs on a 300ms link → exactly 5 distinct rows', async () => {
  await fresh({ latencyMs: 300 });
  for (let i = 0; i < 5; i++) S().addSetLocal('ex-bench', { weight: 225, reps: 5 });
  // the burst returns instantly; drain the chain
  await S().enqueueSync();
  const ids = db.workout_sets.map(r => r.id);
  assert.equal(db.workout_sets.length, 5, `wrote ${db.workout_sets.length} rows, expected 5`);
  assert.equal(new Set(ids).size, 5, 'duplicate ids written');
  assert.equal(S().activeWorkout.exercises[0].sets.length, 5);
});

await t('addSetLocal returns synchronously (no await on the network)', async () => {
  await fresh({ latencyMs: 400 });
  const t0 = Date.now();
  const r = S().addSetLocal('ex-bench', { weight: 135, reps: 10 });
  const elapsed = Date.now() - t0;
  assert.equal(r.ok, true);
  assert.ok(r.localId, 'no localId returned');
  assert.ok(elapsed < 50, `took ${elapsed}ms — still awaiting the network`);
  assert.equal(S().activeWorkout.exercises[0].sets.length, 1, 'set not in store immediately');
  await S().enqueueSync();
});

await t('addSetLocal reports ok:false with no active workout', async () => {
  resetDb();
  useWorkoutStore.setState({ activeWorkout: null });
  const r = S().addSetLocal('ex-bench', { weight: 225, reps: 5 });
  assert.equal(r.ok, false, 'claimed success with no active workout');
  assert.equal(r.localId, null);
});

await t('addSetLocal reports ok:false for an exercise not in the workout', async () => {
  await fresh();
  const r = S().addSetLocal('ex-not-here', { weight: 225, reps: 5 });
  assert.equal(r.ok, false, 'claimed success for an unknown exercise');
});

await t('overlapping syncs do not double-run the PR check', async () => {
  await fresh({ latencyMs: 120 });
  S().addSetLocal('ex-bench', { weight: 405, reps: 5 });
  // three concurrent drains of the same queued row
  await Promise.all([S().enqueueSync(), S().enqueueSync(), S().enqueueSync()]);
  assert.equal(db.workout_sets.length, 1, `wrote ${db.workout_sets.length} rows for one set`);
  const prUpserts = db.calls.filter(c => c === 'personal_records.upsert').length;
  assert.equal(prUpserts, 1, `PR upserted ${prUpserts}x — newPRs would be duplicated in the recap`);
  assert.equal(S().newPRs.length, 1, `newPRs has ${S().newPRs.length} entries`);
});

await t('offline start + concurrent sync creates ONE workout row', async () => {
  resetDb();
  useWorkoutStore.setState({ activeWorkout: null, newPRs: [], syncFailed: false });
  // simulate a session started with no connection: no id on the workout
  useWorkoutStore.setState({
    activeWorkout: { userId: 'user-1', name: 'Push', startedAt: new Date(),
      exercises: [{ exerciseId: 'ex-bench', exerciseName: 'Barbell Bench Press', muscleGroup: 'chest', sets: [] }] },
  });
  db.latencyMs = 100;
  S().addSetLocal('ex-bench', { weight: 225, reps: 5 });
  await Promise.all([S().enqueueSync(), S().enqueueSync()]);
  assert.equal(db.workouts.length, 1, `forked into ${db.workouts.length} workout rows — sets would be orphaned`);
});

await t('a failed sync leaves the set queued and flags syncFailed', async () => {
  await fresh();
  S().addSetLocal('ex-bench', { weight: 225, reps: 5 });
  db.failNext = { code: '500', message: 'boom' };
  const { ok } = await S().enqueueSync();
  assert.equal(ok, false, 'reported success on a failed write');
  assert.equal(S().syncFailed, true, 'syncFailed not set');
  assert.equal(S().activeWorkout.exercises[0].sets[0].id, undefined, 'set marked synced despite failure');
  // and it recovers on the next attempt
  await S().enqueueSync();
  assert.equal(db.workout_sets.length, 1, 'queued set not retried');
  assert.equal(S().syncFailed, false, 'syncFailed not cleared after recovery');
});

await t('logSet still resolves isPR for its own set (back-compat)', async () => {
  await fresh();
  const r = await S().logSet('ex-bench', { weight: 500, reps: 5 }, undefined, 'user-1');
  assert.equal(r.ok, true);
  assert.equal(r.isPR, true, 'first-ever set on an exercise should be a PR');
});

await t('warmup sets never reach the PR check', async () => {
  await fresh();
  S().addSetLocal('ex-bench', { weight: 999, reps: 5, isWarmup: true });
  await S().enqueueSync();
  assert.equal(db.personal_records.length, 0, 'warmup set recorded a PR');
  assert.equal(db.workout_sets[0].is_warmup, true, 'is_warmup not persisted');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
