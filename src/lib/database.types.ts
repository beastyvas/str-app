export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          bodyweight_lbs: number | null;
          unit_pref: 'lbs' | 'kg';
          avatar_url: string | null;
          training_notes: string | null;
          bio: string | null;
          username: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          bodyweight_lbs?: number | null;
          unit_pref?: 'lbs' | 'kg';
          avatar_url?: string | null;
          training_notes?: string | null;
          bio?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          bodyweight_lbs?: number | null;
          unit_pref?: 'lbs' | 'kg';
          avatar_url?: string | null;
          training_notes?: string | null;
          bio?: string | null;
          created_at?: string;
        };
      };
      exercises: {
        Row: {
          id: string;
          name: string;
          muscle_group: string;
          secondary_muscle: string | null;
          equipment_type: string | null;
          is_custom: boolean;
          created_by: string | null;
          form_cues: string | null;
          demo_video_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          muscle_group: string;
          secondary_muscle?: string | null;
          equipment_type?: string | null;
          is_custom?: boolean;
          created_by?: string | null;
          form_cues?: string | null;
          demo_video_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          muscle_group?: string;
          secondary_muscle?: string | null;
          equipment_type?: string | null;
          is_custom?: boolean;
          created_by?: string | null;
          form_cues?: string | null;
          demo_video_url?: string | null;
          created_at?: string;
        };
      };
      workouts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          started_at: string;
          ended_at: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          started_at?: string;
          ended_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          started_at?: string;
          ended_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      workout_sets: {
        Row: {
          id: string;
          workout_id: string;
          exercise_id: string;
          set_number: number;
          weight: number;
          reps: number;
          rpe: number | null;
          note: string | null;
          logged_at: string;
        };
        Insert: {
          id?: string;
          workout_id: string;
          exercise_id: string;
          set_number: number;
          weight: number;
          reps: number;
          rpe?: number | null;
          note?: string | null;
          logged_at?: string;
        };
        Update: {
          id?: string;
          workout_id?: string;
          exercise_id?: string;
          set_number?: number;
          weight?: number;
          reps?: number;
          rpe?: number | null;
          note?: string | null;
          logged_at?: string;
        };
      };
      personal_records: {
        Row: {
          id: string;
          user_id: string;
          exercise_id: string;
          weight: number;
          reps: number;
          achieved_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          exercise_id: string;
          weight: number;
          reps: number;
          achieved_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          exercise_id?: string;
          weight?: number;
          reps?: number;
          achieved_at?: string;
        };
      };
      friendships: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: 'pending' | 'accepted';
          created_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status?: 'pending' | 'accepted';
          created_at?: string;
        };
        Update: {
          id?: string;
          requester_id?: string;
          addressee_id?: string;
          status?: 'pending' | 'accepted';
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

// Convenience row types
export type UserRow = Database['public']['Tables']['users']['Row'];
export type ExerciseRow = Database['public']['Tables']['exercises']['Row'];
export type WorkoutRow = Database['public']['Tables']['workouts']['Row'];
export type WorkoutSetRow = Database['public']['Tables']['workout_sets']['Row'];
export type PersonalRecordRow = Database['public']['Tables']['personal_records']['Row'];
export type FriendshipRow = Database['public']['Tables']['friendships']['Row'];
