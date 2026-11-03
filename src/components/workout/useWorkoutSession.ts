import { useRef } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';
import { computePowerReading, type LiftSet, type PowerReading } from '@/lib/powerLevel';
import { fetchPowerInputs, savePowerReading } from '@/lib/powerData';
import { useWorldStore } from '@/theme/useWorldStore';
import {
  afterSetLogged, fetchSessionCameoContext, finishFacts, freshSessionCameoState, type SessionCameoState,
} from '@/lib/workoutCameos';
import type { ActiveWorkout } from '@/hooks/useWorkout';
import type { WeightUnit } from '@/lib/units';
import type { SummaryPower } from '@/components/summary/types';

// Fire-and-forget: the recap screen should never wait on a photo upload.
// Failures just mean the feed post has no photo — logged, never surfaced.
export async function uploadWorkoutPhotoInBackground(uri: string, workoutId: string, userId: string) {
  try {
    const ext = (uri.split('.').pop()?.split('?')[0]?.toLowerCase().replace('jpeg', 'jpg')) ?? 'jpg';
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const fileName = `${userId}/${workoutId}.${ext}`;
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    const { error: uploadErr } = await supabase.storage
      .from('workout-photos').upload(fileName, bytes, { upsert: true, contentType });
    if (uploadErr) throw uploadErr;
    const { data: urlData } = supabase.storage.from('workout-photos').getPublicUrl(fileName);
    await supabase.from('workout_photos').insert({ workout_id: workoutId, user_id: userId, photo_url: urlData.publicUrl });
  } catch (e: any) {
    console.warn('[workout] background photo upload failed:', e?.message);
  }
}

interface SessionDeps {
  userId: string | undefined;
  bodyweightLbs: number | null | undefined;
  gender: 'male' | 'female' | 'other' | null | undefined;
  unit: WeightUnit;
  firstName: string;
}

/**
 * Per-session Power Level + cameo bookkeeping. The reading is computed once
 * at start (history inputs cached) and again on finish with this session's
 * sets — locally, so it works offline. Never per set.
 */
export function useWorkoutSession(deps: SessionDeps) {
  const powerInputs = useRef<LiftSet[] | null>(null);
  const powerBefore = useRef<PowerReading | null>(null);
  const cameo = useRef<SessionCameoState>(freshSessionCameoState());

  const seed = async () => {
    if (!deps.userId) return;
    cameo.current = freshSessionCameoState();
    fetchSessionCameoContext(deps.userId).then(c => { Object.assign(cameo.current, c); });
    try {
      const inputs = await fetchPowerInputs(deps.userId);
      powerInputs.current = inputs;
      powerBefore.current = computePowerReading(inputs, deps.bodyweightLbs, deps.gender, deps.unit);
    } catch {
      // Offline at start: the summary just skips the Power Level delta.
      powerInputs.current = null;
      powerBefore.current = null;
    }
  };

  const onSetLogged = (set: { exerciseName: string; weight: number; reps: number; isPR: boolean }, restSeconds: number) =>
    afterSetLogged(cameo.current, set, { name: deps.firstName, unit: deps.unit, restSeconds });

  /** Capture this session's sets BEFORE the store clears them. */
  const captureSession = (workout: ActiveWorkout | null) => {
    const sets: LiftSet[] = (workout?.exercises ?? []).flatMap(e =>
      e.sets.map(st => ({
        exerciseName: e.exerciseName, weight: st.weight, reps: st.reps, achievedAt: st.loggedAt, isWarmup: st.isWarmup,
      })),
    );
    const volume = sets.filter(st => !st.isWarmup).reduce((n, st) => n + st.weight * st.reps, 0);
    return { sets, facts: finishFacts(cameo.current, volume) };
  };

  /** Power Level after = history (cached at start) + this session. */
  const finishPower = (sessionSets: LiftSet[]): SummaryPower | null => {
    let out: SummaryPower | null = null;
    if (powerInputs.current && deps.userId) {
      const before = powerBefore.current;
      const after = computePowerReading(
        [...powerInputs.current, ...sessionSets], deps.bodyweightLbs, deps.gender, deps.unit,
      );
      savePowerReading(deps.userId, after);
      const ok = (r: PowerReading | null): r is PowerReading => !!r && r.confidence !== 'calibrating';
      if (ok(after)) useWorldStore.getState().setRank(after.rank.tier.key, after.rank.subTier);
      out = {
        before: ok(before) ? before.power : null,
        after: ok(after) ? after.power : null,
        confidence: after.confidence,
        beforeRank: ok(before) ? { key: before.rank.tier.key, sub: before.rank.subTier, lifts: before.rank.lifts.map(l => l.tier) } : null,
        afterRank: ok(after) ? { key: after.rank.tier.key, sub: after.rank.subTier, lifts: after.rank.lifts.map(l => l.tier) } : null,
      };
    }
    powerInputs.current = null;
    powerBefore.current = null;
    return out;
  };

  return { seed, onSetLogged, captureSession, finishPower };
}
