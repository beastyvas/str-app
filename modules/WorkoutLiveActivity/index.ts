import { Platform } from 'react-native';

// Lazy load — native module only in real iOS builds
let NativeModule: any = null;
try {
  const { requireNativeModule } = require('expo-modules-core');
  NativeModule = requireNativeModule('WorkoutLiveActivity');
} catch {}

export interface WorkoutActivityState {
  exerciseName: string;
  setNumber: number;
  weight: number;
  reps: number;
  totalSets: number;
  restSeconds?: number;
}

export const WorkoutLiveActivity = {
  isAvailable(): boolean {
    if (Platform.OS !== 'ios' || !NativeModule) return false;
    try { return NativeModule.isAvailable(); } catch { return false; }
  },

  async startActivity(workoutName: string, state: WorkoutActivityState): Promise<void> {
    if (!NativeModule) return;
    try { await NativeModule.startActivity({ workoutName, ...state }); } catch {}
  },

  async updateActivity(state: WorkoutActivityState): Promise<void> {
    if (!NativeModule) return;
    try { await NativeModule.updateActivity(state); } catch {}
  },

  async endActivity(): Promise<void> {
    if (!NativeModule) return;
    try { await NativeModule.endActivity(); } catch {}
  },
};
