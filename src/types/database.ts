export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      assessments: {
        Row: {
          assessed_by: string | null;
          assessment_date: string;
          created_at: string;
          data: NonNullable<Json>;
          id: string;
          notes: string | null;
          org_id: string;
          player_id: string;
        };
        Insert: {
          assessed_by?: string | null;
          assessment_date?: string;
          created_at?: string;
          data?: NonNullable<Json>;
          id?: string;
          notes?: string | null;
          org_id: string;
          player_id: string;
        };
        Update: {
          assessed_by?: string | null;
          assessment_date?: string;
          created_at?: string;
          data?: NonNullable<Json>;
          id?: string;
          notes?: string | null;
          org_id?: string;
          player_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessments_assessed_by_fkey";
            columns: ["assessed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessments_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessments_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      exercise_logs: {
        Row: {
          exercise_id: string;
          id: string;
          notes: string | null;
          program_exercise_id: string | null;
          sets_completed: NonNullable<Json>;
          sort_order: number;
          video_url: string | null;
          workout_log_id: string;
        };
        Insert: {
          exercise_id: string;
          id?: string;
          notes?: string | null;
          program_exercise_id?: string | null;
          sets_completed?: NonNullable<Json>;
          sort_order?: number;
          video_url?: string | null;
          workout_log_id: string;
        };
        Update: {
          exercise_id?: string;
          id?: string;
          notes?: string | null;
          program_exercise_id?: string | null;
          sets_completed?: NonNullable<Json>;
          sort_order?: number;
          video_url?: string | null;
          workout_log_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exercise_logs_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercise_logs_program_exercise_id_fkey";
            columns: ["program_exercise_id"];
            isOneToOne: false;
            referencedRelation: "program_exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercise_logs_workout_log_id_fkey";
            columns: ["workout_log_id"];
            isOneToOne: false;
            referencedRelation: "workout_logs";
            referencedColumns: ["id"];
          },
        ];
      };
      exercises: {
        Row: {
          category: Database["public"]["Enums"]["exercise_category"];
          created_at: string;
          created_by: string | null;
          description: string | null;
          equipment: string[];
          id: string;
          instructions: string | null;
          is_custom: boolean;
          muscle_groups: string[];
          name: string;
          org_id: string | null;
          video_demo_url: string | null;
        };
        Insert: {
          category: Database["public"]["Enums"]["exercise_category"];
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          equipment?: string[];
          id?: string;
          instructions?: string | null;
          is_custom?: boolean;
          muscle_groups?: string[];
          name: string;
          org_id?: string | null;
          video_demo_url?: string | null;
        };
        Update: {
          category?: Database["public"]["Enums"]["exercise_category"];
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          equipment?: string[];
          id?: string;
          instructions?: string | null;
          is_custom?: boolean;
          muscle_groups?: string[];
          name?: string;
          org_id?: string | null;
          video_demo_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "exercises_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exercises_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      org_invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          org_id: string;
          role: Database["public"]["Enums"]["org_role"];
          token: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          org_id: string;
          role: Database["public"]["Enums"]["org_role"];
          token?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          org_id?: string;
          role?: Database["public"]["Enums"]["org_role"];
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "org_invitations_accepted_by_fkey";
            columns: ["accepted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "org_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "org_invitations_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      org_memberships: {
        Row: {
          created_at: string;
          id: string;
          jersey_number: number | null;
          org_id: string;
          position: Database["public"]["Enums"]["player_position"] | null;
          profile_id: string;
          role: Database["public"]["Enums"]["org_role"];
          status: Database["public"]["Enums"]["member_status"];
        };
        Insert: {
          created_at?: string;
          id?: string;
          jersey_number?: number | null;
          org_id: string;
          position?: Database["public"]["Enums"]["player_position"] | null;
          profile_id: string;
          role: Database["public"]["Enums"]["org_role"];
          status?: Database["public"]["Enums"]["member_status"];
        };
        Update: {
          created_at?: string;
          id?: string;
          jersey_number?: number | null;
          org_id?: string;
          position?: Database["public"]["Enums"]["player_position"] | null;
          profile_id?: string;
          role?: Database["public"]["Enums"]["org_role"];
          status?: Database["public"]["Enums"]["member_status"];
        };
        Relationships: [
          {
            foreignKeyName: "org_memberships_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "org_memberships_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          current_season_phase: Database["public"]["Enums"]["season_phase"];
          id: string;
          name: string;
          owner_id: string;
          plan_tier: Database["public"]["Enums"]["plan_tier"];
          settings: NonNullable<Json>;
          slug: string;
          sport: string;
        };
        Insert: {
          created_at?: string;
          current_season_phase?: Database["public"]["Enums"]["season_phase"];
          id?: string;
          name: string;
          owner_id: string;
          plan_tier?: Database["public"]["Enums"]["plan_tier"];
          settings?: NonNullable<Json>;
          slug: string;
          sport?: string;
        };
        Update: {
          created_at?: string;
          current_season_phase?: Database["public"]["Enums"]["season_phase"];
          id?: string;
          name?: string;
          owner_id?: string;
          plan_tier?: Database["public"]["Enums"]["plan_tier"];
          settings?: NonNullable<Json>;
          slug?: string;
          sport?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_group_members: {
        Row: {
          group_id: string;
          profile_id: string;
        };
        Insert: {
          group_id: string;
          profile_id: string;
        };
        Update: {
          group_id?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "player_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_group_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_groups: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          org_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          org_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          org_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_groups_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_groups_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          birth_date: string | null;
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
        };
        Insert: {
          avatar_url?: string | null;
          birth_date?: string | null;
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
        };
        Update: {
          avatar_url?: string | null;
          birth_date?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      program_assignments: {
        Row: {
          assigned_by: string | null;
          created_at: string;
          id: string;
          player_id: string;
          program_id: string;
          start_date: string;
          status: Database["public"]["Enums"]["assignment_status"];
        };
        Insert: {
          assigned_by?: string | null;
          created_at?: string;
          id?: string;
          player_id: string;
          program_id: string;
          start_date?: string;
          status?: Database["public"]["Enums"]["assignment_status"];
        };
        Update: {
          assigned_by?: string | null;
          created_at?: string;
          id?: string;
          player_id?: string;
          program_id?: string;
          start_date?: string;
          status?: Database["public"]["Enums"]["assignment_status"];
        };
        Relationships: [
          {
            foreignKeyName: "program_assignments_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "program_assignments_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "program_assignments_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["id"];
          },
        ];
      };
      program_days: {
        Row: {
          day_number: number;
          day_of_week: number | null;
          id: string;
          name: string;
          notes: string | null;
          program_week_id: string;
          session_type: Database["public"]["Enums"]["session_type"];
          sort_order: number;
        };
        Insert: {
          day_number: number;
          day_of_week?: number | null;
          id?: string;
          name?: string;
          notes?: string | null;
          program_week_id: string;
          session_type?: Database["public"]["Enums"]["session_type"];
          sort_order?: number;
        };
        Update: {
          day_number?: number;
          day_of_week?: number | null;
          id?: string;
          name?: string;
          notes?: string | null;
          program_week_id?: string;
          session_type?: Database["public"]["Enums"]["session_type"];
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "program_days_program_week_id_fkey";
            columns: ["program_week_id"];
            isOneToOne: false;
            referencedRelation: "program_weeks";
            referencedColumns: ["id"];
          },
        ];
      };
      program_exercises: {
        Row: {
          exercise_id: string;
          group_id: string | null;
          group_type: Database["public"]["Enums"]["exercise_group_type"] | null;
          id: string;
          intensity: string | null;
          notes: string | null;
          program_day_id: string;
          reps: string | null;
          rest_seconds: number | null;
          sets: number | null;
          sort_order: number;
          tempo: string | null;
        };
        Insert: {
          exercise_id: string;
          group_id?: string | null;
          group_type?: Database["public"]["Enums"]["exercise_group_type"] | null;
          id?: string;
          intensity?: string | null;
          notes?: string | null;
          program_day_id: string;
          reps?: string | null;
          rest_seconds?: number | null;
          sets?: number | null;
          sort_order?: number;
          tempo?: string | null;
        };
        Update: {
          exercise_id?: string;
          group_id?: string | null;
          group_type?: Database["public"]["Enums"]["exercise_group_type"] | null;
          id?: string;
          intensity?: string | null;
          notes?: string | null;
          program_day_id?: string;
          reps?: string | null;
          rest_seconds?: number | null;
          sets?: number | null;
          sort_order?: number;
          tempo?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "program_exercises_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "program_exercises_program_day_id_fkey";
            columns: ["program_day_id"];
            isOneToOne: false;
            referencedRelation: "program_days";
            referencedColumns: ["id"];
          },
        ];
      };
      program_weeks: {
        Row: {
          id: string;
          label: string | null;
          notes: string | null;
          program_id: string;
          week_number: number;
        };
        Insert: {
          id?: string;
          label?: string | null;
          notes?: string | null;
          program_id: string;
          week_number: number;
        };
        Update: {
          id?: string;
          label?: string | null;
          notes?: string | null;
          program_id?: string;
          week_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "program_weeks_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["id"];
          },
        ];
      };
      programs: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          duration_weeks: number | null;
          id: string;
          is_template: boolean;
          name: string;
          org_id: string;
          program_type: Database["public"]["Enums"]["program_type"];
          season_phase: Database["public"]["Enums"]["season_phase"] | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          duration_weeks?: number | null;
          id?: string;
          is_template?: boolean;
          name: string;
          org_id: string;
          program_type?: Database["public"]["Enums"]["program_type"];
          season_phase?: Database["public"]["Enums"]["season_phase"] | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          duration_weeks?: number | null;
          id?: string;
          is_template?: boolean;
          name?: string;
          org_id?: string;
          program_type?: Database["public"]["Enums"]["program_type"];
          season_phase?: Database["public"]["Enums"]["season_phase"] | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "programs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "programs_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      throwing_logs: {
        Row: {
          arm_feel: Database["public"]["Enums"]["arm_feel"] | null;
          created_at: string;
          date: string;
          id: string;
          intensity: Database["public"]["Enums"]["throwing_intensity"] | null;
          logged_by: string | null;
          max_distance_ft: number | null;
          notes: string | null;
          org_id: string;
          pitch_count: number;
          pitches_by_type: Json | null;
          player_id: string;
          throwing_type: Database["public"]["Enums"]["throwing_type"];
        };
        Insert: {
          arm_feel?: Database["public"]["Enums"]["arm_feel"] | null;
          created_at?: string;
          date?: string;
          id?: string;
          intensity?: Database["public"]["Enums"]["throwing_intensity"] | null;
          logged_by?: string | null;
          max_distance_ft?: number | null;
          notes?: string | null;
          org_id: string;
          pitch_count?: number;
          pitches_by_type?: Json | null;
          player_id: string;
          throwing_type: Database["public"]["Enums"]["throwing_type"];
        };
        Update: {
          arm_feel?: Database["public"]["Enums"]["arm_feel"] | null;
          created_at?: string;
          date?: string;
          id?: string;
          intensity?: Database["public"]["Enums"]["throwing_intensity"] | null;
          logged_by?: string | null;
          max_distance_ft?: number | null;
          notes?: string | null;
          org_id?: string;
          pitch_count?: number;
          pitches_by_type?: Json | null;
          player_id?: string;
          throwing_type?: Database["public"]["Enums"]["throwing_type"];
        };
        Relationships: [
          {
            foreignKeyName: "throwing_logs_logged_by_fkey";
            columns: ["logged_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "throwing_logs_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "throwing_logs_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      video_ai_analyses: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          model: string;
          result: NonNullable<Json>;
          video_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          model: string;
          result: NonNullable<Json>;
          video_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          model?: string;
          result?: NonNullable<Json>;
          video_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "video_ai_analyses_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "video_ai_analyses_video_id_fkey";
            columns: ["video_id"];
            isOneToOne: false;
            referencedRelation: "videos";
            referencedColumns: ["id"];
          },
        ];
      };
      video_annotations: {
        Row: {
          author_id: string | null;
          color: string | null;
          comment: string | null;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["annotation_kind"];
          shape: Json | null;
          t_seconds: number;
          video_id: string;
        };
        Insert: {
          author_id?: string | null;
          color?: string | null;
          comment?: string | null;
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["annotation_kind"];
          shape?: Json | null;
          t_seconds: number;
          video_id: string;
        };
        Update: {
          author_id?: string | null;
          color?: string | null;
          comment?: string | null;
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["annotation_kind"];
          shape?: Json | null;
          t_seconds?: number;
          video_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "video_annotations_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "video_annotations_video_id_fkey";
            columns: ["video_id"];
            isOneToOne: false;
            referencedRelation: "videos";
            referencedColumns: ["id"];
          },
        ];
      };
      videos: {
        Row: {
          ai_summary: string | null;
          breakdown_path: string | null;
          created_at: string;
          duration_s: number | null;
          id: string;
          mime_type: string | null;
          notes: string | null;
          org_id: string;
          player_id: string;
          review_summary: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          size_bytes: number | null;
          status: Database["public"]["Enums"]["video_status"];
          storage_path: string;
          thumb_path: string | null;
          title: string;
          uploaded_by: string | null;
          video_type: Database["public"]["Enums"]["video_type"];
        };
        Insert: {
          ai_summary?: string | null;
          breakdown_path?: string | null;
          created_at?: string;
          duration_s?: number | null;
          id?: string;
          mime_type?: string | null;
          notes?: string | null;
          org_id: string;
          player_id: string;
          review_summary?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          size_bytes?: number | null;
          status?: Database["public"]["Enums"]["video_status"];
          storage_path: string;
          thumb_path?: string | null;
          title: string;
          uploaded_by?: string | null;
          video_type?: Database["public"]["Enums"]["video_type"];
        };
        Update: {
          ai_summary?: string | null;
          breakdown_path?: string | null;
          created_at?: string;
          duration_s?: number | null;
          id?: string;
          mime_type?: string | null;
          notes?: string | null;
          org_id?: string;
          player_id?: string;
          review_summary?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          size_bytes?: number | null;
          status?: Database["public"]["Enums"]["video_status"];
          storage_path?: string;
          thumb_path?: string | null;
          title?: string;
          uploaded_by?: string | null;
          video_type?: Database["public"]["Enums"]["video_type"];
        };
        Relationships: [
          {
            foreignKeyName: "videos_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "videos_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "videos_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "videos_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_logs: {
        Row: {
          created_at: string;
          date_completed: string;
          day_name: string | null;
          duration_minutes: number | null;
          id: string;
          notes: string | null;
          overall_rpe: number | null;
          player_id: string;
          program_assignment_id: string;
          program_day_id: string | null;
          status: Database["public"]["Enums"]["workout_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          date_completed?: string;
          day_name?: string | null;
          duration_minutes?: number | null;
          id?: string;
          notes?: string | null;
          overall_rpe?: number | null;
          player_id: string;
          program_assignment_id: string;
          program_day_id?: string | null;
          status: Database["public"]["Enums"]["workout_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          date_completed?: string;
          day_name?: string | null;
          duration_minutes?: number | null;
          id?: string;
          notes?: string | null;
          overall_rpe?: number | null;
          player_id?: string;
          program_assignment_id?: string;
          program_day_id?: string | null;
          status?: Database["public"]["Enums"]["workout_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_logs_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_logs_program_assignment_id_fkey";
            columns: ["program_assignment_id"];
            isOneToOne: false;
            referencedRelation: "program_assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_logs_program_day_id_fkey";
            columns: ["program_day_id"];
            isOneToOne: false;
            referencedRelation: "program_days";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string };
      create_organization: {
        Args: { p_name: string; p_slug: string };
        Returns: {
          created_at: string;
          current_season_phase: Database["public"]["Enums"]["season_phase"];
          id: string;
          name: string;
          owner_id: string;
          plan_tier: Database["public"]["Enums"]["plan_tier"];
          settings: NonNullable<Json>;
          slug: string;
          sport: string;
        };
        SetofOptions: {
          from: "*";
          to: "organizations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      duplicate_program: {
        Args: { p_is_template: boolean; p_name: string; p_program_id: string };
        Returns: string;
      };
      get_invitation: {
        Args: { p_token: string };
        Returns: {
          email: string;
          email_matches: boolean;
          is_accepted: boolean;
          is_expired: boolean;
          org_name: string;
          role: Database["public"]["Enums"]["org_role"];
        }[];
      };
      my_pending_invitations: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          org_name: string;
          role: Database["public"]["Enums"]["org_role"];
          token: string;
        }[];
      };
      save_program_structure: { Args: { p_program_id: string; p_weeks: Json }; Returns: string };
      save_workout_log: {
        Args: {
          p_assignment_id: string;
          p_date: string;
          p_day_id: string;
          p_duration_minutes: number;
          p_exercises: Json;
          p_notes: string;
          p_overall_rpe: number;
          p_status: Database["public"]["Enums"]["workout_status"];
        };
        Returns: string;
      };
      set_current_season_phase: {
        Args: { p_org_id: string; p_phase: Database["public"]["Enums"]["season_phase"] };
        Returns: undefined;
      };
      set_player_birth_date: {
        Args: { p_birth_date: string; p_org_id: string; p_player_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      annotation_kind: "note" | "line" | "arrow" | "angle" | "circle" | "freehand";
      arm_feel: "great" | "good" | "okay" | "tired" | "sore" | "pain";
      assignment_status: "active" | "completed" | "paused";
      exercise_category:
        | "strength"
        | "power"
        | "mobility"
        | "arm_care"
        | "conditioning"
        | "plyometric"
        | "speed"
        | "throwing"
        | "hitting";
      exercise_group_type: "superset" | "circuit" | "emom" | "amrap";
      member_status: "active" | "inactive" | "injured";
      org_role: "admin" | "coach" | "trainer" | "player" | "parent";
      plan_tier: "free" | "pro" | "enterprise";
      player_position: "P" | "C" | "1B" | "2B" | "SS" | "3B" | "OF" | "DH" | "UTIL";
      program_type: "strength" | "throwing" | "arm_care" | "hitting" | "conditioning" | "hybrid";
      season_phase: "off_season" | "pre_season" | "in_season" | "post_season";
      session_type:
        "strength" | "throwing" | "hitting" | "conditioning" | "recovery" | "practice" | "off";
      throwing_intensity: "low" | "moderate" | "high" | "max_effort";
      throwing_type: "long_toss" | "flat_ground" | "bullpen" | "live_abs" | "game" | "check_in";
      video_status: "pending" | "reviewed";
      video_type: "hitting" | "pitching" | "fielding" | "catching" | "exercise_form" | "other";
      workout_status: "completed" | "partial" | "skipped";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      annotation_kind: ["note", "line", "arrow", "angle", "circle", "freehand"],
      arm_feel: ["great", "good", "okay", "tired", "sore", "pain"],
      assignment_status: ["active", "completed", "paused"],
      exercise_category: [
        "strength",
        "power",
        "mobility",
        "arm_care",
        "conditioning",
        "plyometric",
        "speed",
        "throwing",
        "hitting",
      ],
      exercise_group_type: ["superset", "circuit", "emom", "amrap"],
      member_status: ["active", "inactive", "injured"],
      org_role: ["admin", "coach", "trainer", "player", "parent"],
      plan_tier: ["free", "pro", "enterprise"],
      player_position: ["P", "C", "1B", "2B", "SS", "3B", "OF", "DH", "UTIL"],
      program_type: ["strength", "throwing", "arm_care", "hitting", "conditioning", "hybrid"],
      season_phase: ["off_season", "pre_season", "in_season", "post_season"],
      session_type: [
        "strength",
        "throwing",
        "hitting",
        "conditioning",
        "recovery",
        "practice",
        "off",
      ],
      throwing_intensity: ["low", "moderate", "high", "max_effort"],
      throwing_type: ["long_toss", "flat_ground", "bullpen", "live_abs", "game", "check_in"],
      video_status: ["pending", "reviewed"],
      video_type: ["hitting", "pitching", "fielding", "catching", "exercise_form", "other"],
      workout_status: ["completed", "partial", "skipped"],
    },
  },
} as const;
