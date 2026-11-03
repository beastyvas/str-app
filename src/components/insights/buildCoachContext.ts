import { supabase } from '@/lib/supabase';
import type { UserRow } from '@/lib/database.types';

const GOAL_LABELS: Record<string, string> = {
  strength: 'get stronger (SBD focus)', muscle: 'build muscle (hypertrophy)', fat_loss: 'lose fat / recomp',
  compete: 'compete (powerlifting or bodybuilding)', athletic: 'general athletic performance',
};
const EXP_LABELS: Record<string, string> = {
  beginner: 'beginner (under 1 year)', intermediate: 'intermediate (1–3 years)',
  advanced: 'advanced (3+ years)', competitive: 'competitive athlete',
};
const STYLE_LABELS: Record<string, string> = {
  powerlifting: 'powerlifting', bodybuilding: 'bodybuilding', hybrid: 'hybrid strength/size',
  calisthenics: 'calisthenics', athletic: 'athletic/sport performance',
};

/**
 * Athlete data sent to the ai-coach edge function. The prompt skeleton and
 * tier personality live server-side. Every profile field is optional —
 * onboarding no longer collects goal / style / experience.
 */
export async function buildCoachContext(
  userId: string,
  profile: UserRow | null,
  history: { role: 'user' | 'assistant'; content: string }[] | null,
): Promise<string> {
  const [{ data: prs }, { data: recent }] = await Promise.all([
    supabase.from('personal_records').select('weight, reps, achieved_at, exercises(name, muscle_group)')
      .eq('user_id', userId).order('achieved_at', { ascending: false }),
    supabase.from('workouts').select('name, started_at, ended_at, workout_sets(weight, reps, rpe, note, exercises(name))')
      .eq('user_id', userId).order('started_at', { ascending: false }).limit(20),
  ]);

  const workouts = (recent ?? []).map((w: any) => {
    const sets = w.workout_sets ?? [];
    const vol = sets.reduce((n: number, x: any) => n + x.weight * x.reps, 0);
    const byEx: Record<string, any[]> = {};
    sets.forEach((s: any) => { (byEx[s.exercises?.name ?? 'Unknown'] ??= []).push(s); });
    const lines = Object.entries(byEx).map(([name, xs]) => `  ${name}: ${xs.map((s: any) => {
      let str = `${s.weight === 0 ? 'BW' : s.weight}×${s.reps}`;
      if (s.rpe) str += ` @${s.rpe}`;
      if (s.note) str += ` (${s.note})`;
      return str;
    }).join(', ')}`).join('\n');
    const date = new Date(w.started_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
    return `${w.name} (${date}) — ${sets.length} sets, ${vol} lbs total\n${lines}`;
  }).join('\n\n');

  const athlete = [
    profile?.experience_level ? `Experience: ${EXP_LABELS[profile.experience_level] ?? profile.experience_level}` : null,
    profile?.primary_goal ? `Goal: ${GOAL_LABELS[profile.primary_goal] ?? profile.primary_goal}` : null,
    profile?.training_style ? `Training style: ${STYLE_LABELS[profile.training_style] ?? profile.training_style}` : null,
    profile?.bodyweight_lbs ? `Bodyweight: ${profile.bodyweight_lbs} lbs` : null,
  ].filter(Boolean).join('\n');

  const sections = [
    athlete || `Bodyweight: ${profile?.bodyweight_lbs ?? 'unknown'} lbs`,
    `PRs: ${(prs ?? []).map((p: any) => `${p.exercises?.name} ${p.weight}lbs×${p.reps}`).join(', ') || 'none logged'}`,
    `Recent workouts:\n${workouts}`,
  ];
  if (profile?.split_type || profile?.split_schedule) {
    const schedule = (profile.split_schedule ?? {}) as Record<string, string>;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const str = Object.entries(schedule).sort((a, b) => Number(a[0]) - Number(b[0])).map(([d, t]) => `${days[Number(d)]}: ${t}`).join(', ');
    sections.unshift(`TRAINING SPLIT: ${profile.split_type ?? 'Custom'}${str ? `\nSchedule: ${str}` : ''}`);
  }
  if (profile?.training_notes) {
    sections.unshift(`ABOUT THIS ATHLETE (their own words, gym context — read charitably, not literally):\n${profile.training_notes}`);
  }
  // Pro: recent chat history so the coach remembers the conversation
  if (history && history.length > 2) {
    sections.push(`RECENT CONVERSATION HISTORY:\n${history.slice(-10).map(m => `${m.role === 'user' ? 'Athlete' : 'Coach'}: ${m.content}`).join('\n')}`);
  }
  return sections.join('\n\n');
}
