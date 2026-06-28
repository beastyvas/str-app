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
          gender: 'male' | 'female' | 'other' | null;
          created_at: string;
          is_pro: boolean;
          is_owner: boolean;
          is_og: boolean;
          user_number: number | null;
          experience_level: string | null;
          primary_goal: string | null;
          training_style: string | null;
          rc_customer_id: string | null;
          ai_asks_count: number;
          ai_asks_week_start: string | null;
          split_type: string | null;
          split_schedule: Json | null;
          grade_calls_count: number;
          grade_calls_day_start: string | null;
          monthly_analysis_count: number;
          monthly_analysis_month_start: string | null;
          monthly_analysis_last_run: string | null;
          monthly_analysis_last_report: string | null;
          eula_accepted_at: string | null;
          weekly_plan_done: boolean;
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
          username?: string | null;
          gender?: 'male' | 'female' | 'other' | null;
          created_at?: string;
          is_pro?: boolean;
          is_owner?: boolean;
          is_og?: boolean;
          user_number?: number | null;
          experience_level?: string | null;
          primary_goal?: string | null;
          training_style?: string | null;
          rc_customer_id?: string | null;
          ai_asks_count?: number;
          ai_asks_week_start?: string | null;
          split_type?: string | null;
          split_schedule?: Json | null;
          grade_calls_count?: number;
          grade_calls_day_start?: string | null;
          monthly_analysis_count?: number;
          monthly_analysis_month_start?: string | null;
          monthly_analysis_last_run?: string | null;
          monthly_analysis_last_report?: string | null;
          eula_accepted_at?: string | null;
          weekly_plan_done?: boolean;
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
          username?: string | null;
          gender?: 'male' | 'female' | 'other' | null;
          created_at?: string;
          is_pro?: boolean;
          is_owner?: boolean;
          is_og?: boolean;
          user_number?: number | null;
          experience_level?: string | null;
          primary_goal?: string | null;
          training_style?: string | null;
          rc_customer_id?: string | null;
          ai_asks_count?: number;
          ai_asks_week_start?: string | null;
          split_type?: string | null;
          split_schedule?: Json | null;
          grade_calls_count?: number;
          grade_calls_day_start?: string | null;
          monthly_analysis_count?: number;
          monthly_analysis_month_start?: string | null;
          monthly_analysis_last_run?: string | null;
          monthly_analysis_last_report?: string | null;
          eula_accepted_at?: string | null;
          weekly_plan_done?: boolean;
        };
        Relationships: [];
      };
      exercises: {
        Row: {
          id: string;
          name: string;
          muscle_group: string;
          secondary_muscle: string | null;
          equipment_type: string | null;
          exercise_category: string | null;
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
          exercise_category?: string | null;
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
          exercise_category?: string | null;
          is_custom?: boolean;
          created_by?: string | null;
          form_cues?: string | null;
          demo_video_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      workouts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          started_at: string;
          ended_at: string | null;
          notes: string | null;
          is_imported: boolean;
          ai_grade: string | null;
          ai_summary: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          started_at?: string;
          ended_at?: string | null;
          notes?: string | null;
          is_imported?: boolean;
          ai_grade?: string | null;
          ai_summary?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          started_at?: string;
          ended_at?: string | null;
          notes?: string | null;
          is_imported?: boolean;
          ai_grade?: string | null;
          ai_summary?: string | null;
          created_at?: string;
        };
        Relationships: [];
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
          is_warmup: boolean;
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
          is_warmup?: boolean;
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
          is_warmup?: boolean;
          logged_at?: string;
        };
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      workout_templates: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          exercises: Json;
          day_of_week: number | null;
          created_at: string;
          last_used_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          exercises?: Json;
          day_of_week?: number | null;
          created_at?: string;
          last_used_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          exercises?: Json;
          day_of_week?: number | null;
          created_at?: string;
          last_used_at?: string | null;
        };
        Relationships: [];
      };
      workout_comments: {
        Row: {
          id: string;
          workout_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workout_id: string;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workout_id?: string;
          user_id?: string;
          content?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      workout_likes: {
        Row: {
          id: string;
          workout_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workout_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workout_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      workout_photos: {
        Row: {
          id: string;
          workout_id: string;
          user_id: string;
          photo_url: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workout_id: string;
          user_id: string;
          photo_url: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          workout_id?: string;
          user_id?: string;
          photo_url?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      content_reports: {
        Row: {
          id: string;
          reporter_id: string;
          reported_user_id: string | null;
          content_type: string;
          content_id: string | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          reported_user_id?: string | null;
          content_type: string;
          content_id?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          reported_user_id?: string | null;
          content_type?: string;
          content_id?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      blocked_users: {
        Row: {
          id: string;
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          blocker_id: string;
          blocked_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          blocker_id?: string;
          blocked_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      // Safe, public-readable projection of users (see migration 018/019).
      // Views are read-only — selects only.
      public_profiles: {
        Row: {
          id: string | null;
          username: string | null;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          bodyweight_lbs: number | null;
          unit_pref: 'lbs' | 'kg' | null;
          is_pro: boolean | null;
          is_og: boolean | null;
          is_owner: boolean | null;
          split_type: string | null;
          split_schedule: Json | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      delete_user: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
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
export type WorkoutTemplateRow = Database['public']['Tables']['workout_templates']['Row'];
export type WorkoutCommentRow = Database['public']['Tables']['workout_comments']['Row'];
export type WorkoutLikeRow = Database['public']['Tables']['workout_likes']['Row'];
export type WorkoutPhotoRow = Database['public']['Tables']['workout_photos']['Row'];
export type PublicProfileRow = Database['public']['Views']['public_profiles']['Row'];
