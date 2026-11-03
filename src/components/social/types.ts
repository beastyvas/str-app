// Shared Social types + small formatters.
export interface ExerciseSummary {
  name: string;
  setCount: number;
  topWeight: number;
  topReps: number;
  sets: { weight: number; reps: number }[];
}

export interface FeedComment {
  id: string;
  content: string;
  displayName: string;
  avatarUrl?: string;
}

export interface FeedPost {
  workoutId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  isOwner?: boolean;
  isOg?: boolean;
  isPro?: boolean;
  workoutName: string;
  startedAt: string;
  endedAt: string;
  notes?: string;
  setsCount: number;
  totalVolume: number;
  exercises: string[];
  exerciseSummaries: ExerciseSummary[];
  rankTierLabel?: string;
  rankTierColor?: string;
  photoUrl?: string;
  likeCount: number;
  isLiked: boolean;
  commentCount: number;
  previewComments: FeedComment[];
}

export interface Friend {
  username?: string;
  id: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  bodyweight_lbs?: number;
  friendshipId: string;
  rankTierLabel?: string;
  rankTierColor?: string;
  powerLevel?: number | null;
  powerPartial?: boolean;
  recentPR?: { exerciseName: string; weight: number; achieved_at: string };
  is_owner?: boolean;
  is_og?: boolean;
  is_pro?: boolean;
}

export interface PendingRequest {
  id: string;
  friendshipId: string;
  display_name: string;
  avatar_url?: string;
}


export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: days > 365 ? 'numeric' : undefined });
}


export function formatDuration(start: string, end: string) {
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
