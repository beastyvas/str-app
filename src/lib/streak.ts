// Consecutive-training-day streak, previously copy-pasted in history.tsx
// (twice) and profile.tsx. A gap today doesn't break the streak (d > 0 rule)
// so an evening lifter still shows their streak before training.

export function computeStreak(startDates: Iterable<string | Date>, maxDays = 90): number {
  const daySet = new Set<string>();
  for (const d of startDates) daySet.add(new Date(d).toDateString());
  let streak = 0;
  for (let d = 0; d < maxDays; d++) {
    const day = new Date();
    day.setDate(day.getDate() - d);
    if (daySet.has(day.toDateString())) streak++;
    else if (d > 0) break;
  }
  return streak;
}
