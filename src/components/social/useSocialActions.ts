import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Camera } from 'expo-camera';
import { supabase } from '@/lib/supabase';
import { screenText } from '@/lib/contentFilter';
import { useModeration } from '@/hooks/useModeration';
import type { FeedPost, Friend, PendingRequest } from './types';

interface Deps {
  userId: string | undefined;
  friends: Friend[];
  setFeed: (fn: (p: FeedPost[]) => FeedPost[]) => void;
  setFriends: (fn: (p: Friend[]) => Friend[]) => void;
  setPending: (fn: (p: PendingRequest[]) => PendingRequest[]) => void;
  reload: () => void;
}

/** Search, requests, likes, comments, QR scan, report/block — logic unchanged from the old screen. */
export function useSocialActions({ userId, friends, setFeed, setFriends, setPending, reload }: Deps) {
  const { reportContent, blockUser } = useModeration();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const scanHandled = useRef(false);
  const [commentWorkoutId, setCommentWorkoutId] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);

  const runSearch = async () => {
    if (!search.trim() || !userId) return;
    setSearching(true);
    try {
      const q = search.trim().replace(/^@/, '');
      const { data: users, error } = await supabase.from('public_profiles')
        .select('id, display_name, avatar_url, bio, username')
        .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`).neq('id', userId).limit(10);
      if (error) { Alert.alert('Search error', error.message); return; }
      const { data: mine } = await supabase.from('friendships').select('requester_id, addressee_id, status')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
      const friendIds = new Set((mine ?? []).filter(f => f.status === 'accepted').map(f => (f.requester_id === userId ? f.addressee_id : f.requester_id)));
      const sentIds = new Set((mine ?? []).filter(f => f.status === 'pending' && f.requester_id === userId).map(f => f.addressee_id));
      setResults((users ?? []).map((u: any) => ({ ...u, alreadyFriend: friendIds.has(u.id), requestSent: sentIds.has(u.id) })));
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async (toId: string) => {
    if (!userId) return;
    const { data: row } = await supabase.from('friendships').insert({ requester_id: userId, addressee_id: toId }).select('status').single();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setResults(prev => prev.map(u => (u.id === toId ? { ...u, requestSent: true } : u)));
    // Creator requests auto-accept server-side — reload so they appear at once
    if (row?.status === 'accepted') reload();
  };

  const accept = async (friendshipId: string) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    reload();
  };
  const decline = async (friendshipId: string) => {
    await supabase.from('friendships').delete().eq('id', friendshipId);
    setPending(prev => prev.filter(p => p.friendshipId !== friendshipId));
  };
  const remove = (friendshipId: string, name: string) => Alert.alert('Remove friend', `Remove ${name}?`, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Remove', style: 'destructive', onPress: async () => {
        await supabase.from('friendships').delete().eq('id', friendshipId);
        setFriends(prev => prev.filter(f => f.friendshipId !== friendshipId));
      },
    },
  ]);

  const toggleLike = async (post: FeedPost) => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const liked = post.isLiked;
    setFeed(prev => prev.map(p => (p.workoutId === post.workoutId ? { ...p, isLiked: !liked, likeCount: p.likeCount + (liked ? -1 : 1) } : p)));
    if (liked) await supabase.from('workout_likes').delete().eq('workout_id', post.workoutId).eq('user_id', userId);
    else await supabase.from('workout_likes').insert({ workout_id: post.workoutId, user_id: userId });
  };

  const openComments = async (workoutId: string) => {
    setCommentWorkoutId(workoutId);
    setComments([]);
    setLoadingComments(true);
    const { data } = await supabase.from('workout_comments').select('id, content, created_at, user_id')
      .eq('workout_id', workoutId).order('created_at', { ascending: true });
    const ids = Array.from(new Set((data ?? []).map((c: any) => c.user_id)));
    const { data: profiles } = ids.length
      ? await supabase.from('public_profiles').select('id, display_name, avatar_url').in('id', ids)
      : { data: [] as any[] };
    const map: Record<string, any> = {};
    (profiles ?? []).forEach((p: any) => { map[p.id] = p; });
    setComments((data ?? []).map((c: any) => ({ ...c, users: { display_name: map[c.user_id]?.display_name, avatar_url: map[c.user_id]?.avatar_url } })));
    setLoadingComments(false);
  };

  const sendComment = async () => {
    if (!commentText.trim() || !userId || !commentWorkoutId) return;
    const issue = screenText(commentText, 'comment');
    if (issue) { Alert.alert('Not allowed', issue); return; }
    setSendingComment(true);
    const { data } = await supabase.from('workout_comments')
      .insert({ workout_id: commentWorkoutId, user_id: userId, content: commentText.trim() })
      .select('id, content, created_at, users(display_name, avatar_url)').single();
    if (data) {
      setComments(prev => [...prev, data]);
      setFeed(prev => prev.map(p => (p.workoutId === commentWorkoutId ? {
        ...p,
        commentCount: p.commentCount + 1,
        previewComments: [...p.previewComments, {
          id: (data as any).id, content: (data as any).content,
          displayName: (data as any).users?.display_name ?? 'Unknown', avatarUrl: (data as any).users?.avatar_url,
        }].slice(-2),
      } : p)));
    }
    setCommentText('');
    setSendingComment(false);
  };

  const openScanner = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status === 'granted') { scanHandled.current = false; setScannerOpen(true); }
    else Alert.alert('Camera permission needed to scan QR codes');
  };

  const handleScan = async (data: string) => {
    if (scanHandled.current) return; // prevent duplicate fires
    scanHandled.current = true;
    setScannerOpen(false);
    const match = data.match(/str:\/\/profile\/(.+)/); // "str://profile/USER_ID"
    if (!match) { Alert.alert('Invalid QR code'); return; }
    const id = match[1];
    if (id === userId) { Alert.alert("That's your own QR code"); return; }
    if (friends.find(f => f.id === id)) { Alert.alert('Already friends'); return; }
    const { data: prof } = await supabase.from('public_profiles').select('display_name, username').eq('id', id).single();
    Alert.alert(`Add ${prof?.display_name ?? 'this person'}?`, prof?.username ? `@${prof.username}` : undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Add friend', onPress: () => sendRequest(id) },
    ]);
  };

  // Report / block a post's author (Guideline 1.2)
  const safetyMenu = (post: FeedPost) => Alert.alert(post.displayName, 'Keep STR safe', [
    {
      text: 'Report post', onPress: async () => {
        const ok = await reportContent({ reportedUserId: post.userId, contentType: 'workout', contentId: post.workoutId });
        Alert.alert(ok ? 'Reported' : 'Error', ok ? 'Thanks — this will be reviewed within 24 hours.' : 'Could not file the report. Please try again.');
      },
    },
    {
      text: `Block ${post.displayName}`, style: 'destructive', onPress: () => Alert.alert('Block user', `Block ${post.displayName}? Their posts will be removed from your feed.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block', style: 'destructive', onPress: async () => {
            const ok = await blockUser(post.userId);
            if (ok) { setFeed(prev => prev.filter(p => p.userId !== post.userId)); reload(); }
            else Alert.alert('Error', 'Could not block this user. Please try again.');
          },
        },
      ]),
    },
    { text: 'Cancel', style: 'cancel' },
  ]);

  return {
    search, setSearch, results, searching, runSearch, sendRequest, accept, decline, remove,
    toggleLike, safetyMenu,
    comments: { workoutId: commentWorkoutId, close: () => setCommentWorkoutId(null), open: openComments, list: comments, text: commentText, setText: setCommentText, loading: loadingComments, sending: sendingComment, send: sendComment },
    scanner: { open: scannerOpen, start: openScanner, close: () => setScannerOpen(false), onScan: handleScan },
  };
}
