import { Platform } from 'react-native';

// Lazy-load expo-notifications — it requires a native build to be compiled in.
// If the native module isn't present (e.g. running in a dev build that predates
// the install), all functions below become silent no-ops so the workout tab still loads.
let N: typeof import('expo-notifications') | null = null;
try {
  N = require('expo-notifications');
} catch {}

const WORKOUT_NOTIF_ID = 'str-active-workout';
const REST_ALERT_ID    = 'str-rest-alert';

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!N) return false;
  const { status } = await N.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: false, allowCriticalAlerts: false },
  });
  return status === 'granted';
}

export async function setupNotificationChannels() {
  if (!N || Platform.OS !== 'android') return;
  await N.setNotificationChannelAsync('workout', {
    name: 'Active Workout',
    importance: N.AndroidImportance.LOW,
    showBadge: false,
    sound: null,
    vibrationPattern: null,
    enableVibrate: false,
  });
  await N.setNotificationChannelAsync('rest-alert', {
    name: 'Rest Timer Alert',
    importance: N.AndroidImportance.HIGH,
    showBadge: false,
    sound: null,
    vibrationPattern: [0, 250],
    enableVibrate: true,
  });
}

function fmtElapsed(secondsAgo: number): string {
  const m = Math.floor(secondsAgo / 60);
  const s = secondsAgo % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

let _workoutName = '';
let _lastExercise = '';
let _lastSetNum = 0;
let _lastSetAt: Date | null = null;
let _updateInterval: ReturnType<typeof setInterval> | null = null;

export async function notifyWorkoutStarted(workoutName: string) {
  if (!N) return;
  _workoutName = workoutName;
  _lastExercise = '';
  _lastSetNum = 0;
  _lastSetAt = null;

  await N.dismissNotificationAsync(WORKOUT_NOTIF_ID).catch(() => {});
  await N.scheduleNotificationAsync({
    identifier: WORKOUT_NOTIF_ID,
    content: {
      title: `🏋️ ${workoutName}`,
      body: 'Workout started — tap to log sets',
      data: { url: '/(tabs)/workout' },
      categoryIdentifier: 'workout',
      sticky: true,
      ...(Platform.OS === 'android' && { channelId: 'workout' }),
    },
    trigger: null,
  });
}

export async function notifySetLogged(
  exerciseName: string,
  setNumber: number,
  restAlertSeconds: number
) {
  if (!N) return;
  _lastExercise = exerciseName;
  _lastSetNum = setNumber;
  _lastSetAt = new Date();

  await _updateActiveNotif(0);

  _clearUpdateInterval();
  _updateInterval = setInterval(async () => {
    if (!_lastSetAt) return;
    const elapsed = Math.floor((Date.now() - _lastSetAt.getTime()) / 1000);
    await _updateActiveNotif(elapsed);
  }, 60_000);

  await N.cancelScheduledNotificationAsync(REST_ALERT_ID).catch(() => {});
  if (restAlertSeconds > 0) {
    await N.scheduleNotificationAsync({
      identifier: REST_ALERT_ID,
      content: {
        title: `⏱ Rest complete`,
        body: `Time for set ${setNumber + 1}${_lastExercise ? ` of ${_lastExercise}` : ''}`,
        data: { url: '/(tabs)/workout' },
        sound: false,
        ...(Platform.OS === 'android' && { channelId: 'rest-alert', vibrate: [0, 250] }),
      },
      trigger: { seconds: restAlertSeconds, type: N.SchedulableTriggerInputTypes.TIME_INTERVAL },
    });
  }
}

async function _updateActiveNotif(elapsedSeconds: number) {
  if (!N) return;
  const restText = elapsedSeconds > 0
    ? `Resting ${fmtElapsed(elapsedSeconds)} · tap to continue`
    : `Set ${_lastSetNum} done · resting now`;

  const body = _lastExercise
    ? `${_lastExercise}  ·  ${restText}`
    : restText;

  await N.scheduleNotificationAsync({
    identifier: WORKOUT_NOTIF_ID,
    content: {
      title: `🏋️ ${_workoutName}`,
      body,
      data: { url: '/(tabs)/workout' },
      sticky: true,
      ...(Platform.OS === 'android' && { channelId: 'workout' }),
    },
    trigger: null,
  });
}

function _clearUpdateInterval() {
  if (_updateInterval) {
    clearInterval(_updateInterval);
    _updateInterval = null;
  }
}

export async function clearWorkoutNotifications() {
  if (!N) return;
  _clearUpdateInterval();
  _lastSetAt = null;
  _workoutName = '';
  await Promise.all([
    N.dismissNotificationAsync(WORKOUT_NOTIF_ID).catch(() => {}),
    N.cancelScheduledNotificationAsync(REST_ALERT_ID).catch(() => {}),
  ]);
  await N.dismissAllNotificationsAsync();
}

export function getWorkoutUrlFromResponse(response: any): string | null {
  const data = response?.notification?.request?.content?.data as any;
  return data?.url ?? null;
}
