import type {
  TeamOperationsTables,
  TeamOperationsViews,
  TeamOperationsFunctions,
} from "./team-operations";
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: TeamOperationsTables & {
      announcement_reads: {
        Row: {
          announcement_id: string;
          profile_id: string;
          read_at: string;
        };
        Insert: {
          announcement_id: string;
          profile_id: string;
          read_at?: string;
        };
        Update: {
          announcement_id?: string;
          profile_id?: string;
          read_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey";
            columns: ["announcement_id"];
            isOneToOne: false;
            referencedRelation: "announcements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcement_reads_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      announcements: {
        Row: {
          recipient_ids: string[] | null;
          audience_scope: string;
          author_id: string | null;
          body: string;
          created_at: string;
          group_id: string | null;
          id: string;
          include_parents: boolean;
          org_id: string;
          pinned: boolean;
          title: string;
        };
        Insert: {
          recipient_ids?: string[] | null;
          audience_scope?: string;
          author_id?: string | null;
          body: string;
          created_at?: string;
          group_id?: string | null;
          id?: string;
          include_parents?: boolean;
          org_id: string;
          pinned?: boolean;
          title: string;
        };
        Update: {
          recipient_ids?: string[] | null;
          audience_scope?: string;
          author_id?: string | null;
          body?: string;
          created_at?: string;
          group_id?: string | null;
          id?: string;
          include_parents?: boolean;
          org_id?: string;
          pinned?: boolean;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcements_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "player_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcements_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
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
          tracking_type: Database["public"]["Enums"]["tracking_type"];
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
          tracking_type?: Database["public"]["Enums"]["tracking_type"];
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
          tracking_type?: Database["public"]["Enums"]["tracking_type"];
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
      feedback: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          message: string;
          org_id: string | null;
          path: string | null;
          profile_id: string | null;
          role: string | null;
          user_agent: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind?: string;
          message: string;
          org_id?: string | null;
          path?: string | null;
          profile_id?: string | null;
          role?: string | null;
          user_agent?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          message?: string;
          org_id?: string | null;
          path?: string | null;
          profile_id?: string | null;
          role?: string | null;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "feedback_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "feedback_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      game_batting: {
        Row: {
          ab: number;
          batting_order: number | null;
          bb: number;
          cs: number;
          doubles: number;
          e: number;
          game_id: string;
          h: number;
          hbp: number;
          hr: number;
          id: string;
          org_id: string;
          player_id: string;
          position: string | null;
          r: number;
          rbi: number;
          sac: number;
          sb: number;
          sf: number;
          so: number;
          triples: number;
        };
        Insert: {
          ab?: number;
          batting_order?: number | null;
          bb?: number;
          cs?: number;
          doubles?: number;
          e?: number;
          game_id: string;
          h?: number;
          hbp?: number;
          hr?: number;
          id?: string;
          org_id: string;
          player_id: string;
          position?: string | null;
          r?: number;
          rbi?: number;
          sac?: number;
          sb?: number;
          sf?: number;
          so?: number;
          triples?: number;
        };
        Update: {
          ab?: number;
          batting_order?: number | null;
          bb?: number;
          cs?: number;
          doubles?: number;
          e?: number;
          game_id?: string;
          h?: number;
          hbp?: number;
          hr?: number;
          id?: string;
          org_id?: string;
          player_id?: string;
          position?: string | null;
          r?: number;
          rbi?: number;
          sac?: number;
          sb?: number;
          sf?: number;
          so?: number;
          triples?: number;
        };
        Relationships: [
          {
            foreignKeyName: "game_batting_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_batting_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_batting_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      game_pitching: {
        Row: {
          bb: number;
          decision: string | null;
          er: number;
          game_id: string;
          h: number;
          hbp: number;
          hr: number;
          id: string;
          org_id: string;
          outs: number;
          pitches: number | null;
          player_id: string;
          r: number;
          so: number;
          sort_order: number;
          strikes: number | null;
        };
        Insert: {
          bb?: number;
          decision?: string | null;
          er?: number;
          game_id: string;
          h?: number;
          hbp?: number;
          hr?: number;
          id?: string;
          org_id: string;
          outs?: number;
          pitches?: number | null;
          player_id: string;
          r?: number;
          so?: number;
          sort_order?: number;
          strikes?: number | null;
        };
        Update: {
          bb?: number;
          decision?: string | null;
          er?: number;
          game_id?: string;
          h?: number;
          hbp?: number;
          hr?: number;
          id?: string;
          org_id?: string;
          outs?: number;
          pitches?: number | null;
          player_id?: string;
          r?: number;
          so?: number;
          sort_order?: number;
          strikes?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "game_pitching_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_pitching_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_pitching_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      game_plays: {
        Row: {
          batter_id: string | null;
          created_at: string;
          created_by: string | null;
          game_id: string;
          half: string;
          id: string;
          inning: number;
          kind: string;
          note: string | null;
          org_id: string;
          outs: number;
          pitcher_id: string | null;
          pitches: number;
          play_details: Json | null;
          rbi: number;
          result: string | null;
          runs: number;
          scored: string[];
          seq: number;
          slot: number | null;
          unearned: number;
          we_bat: boolean;
        };
        Insert: {
          batter_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          game_id: string;
          half: string;
          id?: string;
          inning: number;
          kind: string;
          note?: string | null;
          org_id: string;
          outs?: number;
          pitcher_id?: string | null;
          pitches?: number;
          play_details?: Json | null;
          rbi?: number;
          result?: string | null;
          runs?: number;
          scored?: string[];
          seq: number;
          slot?: number | null;
          unearned?: number;
          we_bat: boolean;
        };
        Update: {
          batter_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          game_id?: string;
          half?: string;
          id?: string;
          inning?: number;
          kind?: string;
          note?: string | null;
          org_id?: string;
          outs?: number;
          pitcher_id?: string | null;
          pitches?: number;
          play_details?: Json | null;
          rbi?: number;
          result?: string | null;
          runs?: number;
          scored?: string[];
          seq?: number;
          slot?: number | null;
          unearned?: number;
          we_bat?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "game_plays_batter_id_fkey";
            columns: ["batter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_plays_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_plays_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_plays_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_plays_pitcher_id_fkey";
            columns: ["pitcher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      games: {
        Row: {
          address: string | null;
          arrival_time: string | null;
          created_at: string;
          created_by: string | null;
          current_inning: number | null;
          date: string;
          group_id: string | null;
          home_away: Database["public"]["Enums"]["home_away"];
          id: string;
          innings_scheduled: number;
          kind: Database["public"]["Enums"]["game_kind"];
          line_score: NonNullable<Json>;
          live_state: Json | null;
          location: string | null;
          notes: string | null;
          opponent: string;
          opponent_score: number | null;
          org_id: string;
          start_time: string | null;
          status: Database["public"]["Enums"]["game_status"];
          team_score: number | null;
          tournament_id: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          arrival_time?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_inning?: number | null;
          date: string;
          group_id?: string | null;
          home_away?: Database["public"]["Enums"]["home_away"];
          id?: string;
          innings_scheduled?: number;
          kind?: Database["public"]["Enums"]["game_kind"];
          line_score?: NonNullable<Json>;
          live_state?: Json | null;
          location?: string | null;
          notes?: string | null;
          opponent: string;
          opponent_score?: number | null;
          org_id: string;
          start_time?: string | null;
          status?: Database["public"]["Enums"]["game_status"];
          team_score?: number | null;
          tournament_id?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          arrival_time?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_inning?: number | null;
          date?: string;
          group_id?: string | null;
          home_away?: Database["public"]["Enums"]["home_away"];
          id?: string;
          innings_scheduled?: number;
          kind?: Database["public"]["Enums"]["game_kind"];
          line_score?: NonNullable<Json>;
          live_state?: Json | null;
          location?: string | null;
          notes?: string | null;
          opponent?: string;
          opponent_score?: number | null;
          org_id?: string;
          start_time?: string | null;
          status?: Database["public"]["Enums"]["game_status"];
          team_score?: number | null;
          tournament_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "games_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "games_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "player_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "games_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "games_tournament_id_fkey";
            columns: ["tournament_id"];
            isOneToOne: false;
            referencedRelation: "tournaments";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          actor_id: string | null;
          body: string | null;
          created_at: string;
          href: string | null;
          id: string;
          kind: string;
          org_id: string;
          profile_id: string;
          pushed_at: string | null;
          read_at: string | null;
          title: string;
        };
        Insert: {
          actor_id?: string | null;
          body?: string | null;
          created_at?: string;
          href?: string | null;
          id?: string;
          kind: string;
          org_id: string;
          profile_id: string;
          pushed_at?: string | null;
          read_at?: string | null;
          title: string;
        };
        Update: {
          actor_id?: string | null;
          body?: string | null;
          created_at?: string;
          href?: string | null;
          id?: string;
          kind?: string;
          org_id?: string;
          profile_id?: string;
          pushed_at?: string | null;
          read_at?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
          player_id: string | null;
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
          player_id?: string | null;
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
          player_id?: string | null;
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
          {
            foreignKeyName: "org_invitations_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
          is_demo: boolean;
          modules: string[];
          name: string;
          owner_id: string;
          plan_renews_at: string | null;
          plan_status: string | null;
          plan_tier: Database["public"]["Enums"]["plan_tier"];
          settings: NonNullable<Json>;
          slug: string;
          sport: string;
          stats_visibility: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          team_type: string | null;
        };
        Insert: {
          created_at?: string;
          current_season_phase?: Database["public"]["Enums"]["season_phase"];
          id?: string;
          is_demo?: boolean;
          modules?: string[];
          name: string;
          owner_id: string;
          plan_renews_at?: string | null;
          plan_status?: string | null;
          plan_tier?: Database["public"]["Enums"]["plan_tier"];
          settings?: NonNullable<Json>;
          slug: string;
          sport?: string;
          stats_visibility?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          team_type?: string | null;
        };
        Update: {
          created_at?: string;
          current_season_phase?: Database["public"]["Enums"]["season_phase"];
          id?: string;
          is_demo?: boolean;
          modules?: string[];
          name?: string;
          owner_id?: string;
          plan_renews_at?: string | null;
          plan_status?: string | null;
          plan_tier?: Database["public"]["Enums"]["plan_tier"];
          settings?: NonNullable<Json>;
          slug?: string;
          sport?: string;
          stats_visibility?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          team_type?: string | null;
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
      parent_links: {
        Row: {
          created_at: string;
          id: string;
          org_id: string;
          parent_id: string;
          player_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          org_id: string;
          parent_id: string;
          player_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          org_id?: string;
          parent_id?: string;
          player_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "parent_links_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "parent_links_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "parent_links_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      parental_consents: {
        Row: {
          child_id: string;
          consented_at: string | null;
          id: string;
          parent_email: string;
          parent_id: string | null;
          parent_name: string | null;
          requested_at: string;
          revoked_at: string | null;
          token: string;
        };
        Insert: {
          child_id: string;
          consented_at?: string | null;
          id?: string;
          parent_email: string;
          parent_id?: string | null;
          parent_name?: string | null;
          requested_at?: string;
          revoked_at?: string | null;
          token?: string;
        };
        Update: {
          child_id?: string;
          consented_at?: string | null;
          id?: string;
          parent_email?: string;
          parent_id?: string | null;
          parent_name?: string | null;
          requested_at?: string;
          revoked_at?: string | null;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "parental_consents_child_id_fkey";
            columns: ["child_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "parental_consents_parent_id_fkey";
            columns: ["parent_id"];
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
      practice_blocks: {
        Row: {
          details: string | null;
          duration_min: number;
          id: string;
          kind: Database["public"]["Enums"]["practice_block_kind"];
          plan_id: string;
          sort_order: number;
          stations: NonNullable<Json>;
          title: string;
        };
        Insert: {
          details?: string | null;
          duration_min: number;
          id?: string;
          kind?: Database["public"]["Enums"]["practice_block_kind"];
          plan_id: string;
          sort_order?: number;
          stations?: NonNullable<Json>;
          title: string;
        };
        Update: {
          details?: string | null;
          duration_min?: number;
          id?: string;
          kind?: Database["public"]["Enums"]["practice_block_kind"];
          plan_id?: string;
          sort_order?: number;
          stations?: NonNullable<Json>;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "practice_blocks_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "practice_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      practice_plans: {
        Row: {
          canceled: boolean;
          created_at: string;
          created_by: string | null;
          date: string | null;
          group_id: string | null;
          id: string;
          is_template: boolean;
          location: string | null;
          notes: string | null;
          org_id: string;
          published: boolean;
          start_time: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          canceled?: boolean;
          created_at?: string;
          created_by?: string | null;
          date?: string | null;
          group_id?: string | null;
          id?: string;
          is_template?: boolean;
          location?: string | null;
          notes?: string | null;
          org_id: string;
          published?: boolean;
          start_time?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          canceled?: boolean;
          created_at?: string;
          created_by?: string | null;
          date?: string | null;
          group_id?: string | null;
          id?: string;
          is_template?: boolean;
          location?: string | null;
          notes?: string | null;
          org_id?: string;
          published?: boolean;
          start_time?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "practice_plans_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "practice_plans_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "player_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "practice_plans_org_id_fkey";
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
          push_muted: string[];
        };
        Insert: {
          avatar_url?: string | null;
          birth_date?: string | null;
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          push_muted?: string[];
        };
        Update: {
          avatar_url?: string | null;
          birth_date?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          push_muted?: string[];
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
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          p256dh: string;
          profile_id: string;
          user_agent: string | null;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          profile_id: string;
          user_agent?: string | null;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          profile_id?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      team_import_rows: {
        Row: {
          created_at: string;
          game_id: string | null;
          id: string;
          identity_key: string;
          imported_by: string | null;
          kind: string;
          org_id: string;
          player_id: string | null;
          season: string;
          source: string;
          values: NonNullable<Json>;
        };
        Insert: {
          created_at?: string;
          game_id?: string | null;
          id?: string;
          identity_key: string;
          imported_by?: string | null;
          kind: string;
          org_id: string;
          player_id?: string | null;
          season: string;
          source: string;
          values: NonNullable<Json>;
        };
        Update: {
          created_at?: string;
          game_id?: string | null;
          id?: string;
          identity_key?: string;
          imported_by?: string | null;
          kind?: string;
          org_id?: string;
          player_id?: string | null;
          season?: string;
          source?: string;
          values?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: "team_import_rows_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_import_rows_imported_by_fkey";
            columns: ["imported_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_import_rows_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_import_rows_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      thread_members: {
        Row: {
          last_read_at: string | null;
          profile_id: string;
          thread_id: string;
        };
        Insert: {
          last_read_at?: string | null;
          profile_id: string;
          thread_id: string;
        };
        Update: {
          last_read_at?: string | null;
          profile_id?: string;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "thread_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "thread_members_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "threads";
            referencedColumns: ["id"];
          },
        ];
      };
      thread_messages: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          id: string;
          thread_id: string;
        };
        Insert: {
          author_id?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          thread_id: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "thread_messages_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "thread_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "threads";
            referencedColumns: ["id"];
          },
        ];
      };
      threads: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          last_message_at: string;
          org_id: string;
          subject: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_message_at?: string;
          org_id: string;
          subject?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_message_at?: string;
          org_id?: string;
          subject?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "threads_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "threads_org_id_fkey";
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
          game_id: string | null;
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
          game_id?: string | null;
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
          game_id?: string | null;
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
            foreignKeyName: "throwing_logs_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
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
      tournaments: {
        Row: {
          address: string | null;
          created_at: string;
          created_by: string | null;
          end_date: string;
          group_id: string | null;
          id: string;
          location: string | null;
          name: string;
          notes: string | null;
          org_id: string;
          start_date: string;
          url: string | null;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          created_by?: string | null;
          end_date: string;
          group_id?: string | null;
          id?: string;
          location?: string | null;
          name: string;
          notes?: string | null;
          org_id: string;
          start_date: string;
          url?: string | null;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          created_by?: string | null;
          end_date?: string;
          group_id?: string | null;
          id?: string;
          location?: string | null;
          name?: string;
          notes?: string | null;
          org_id?: string;
          start_date?: string;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tournaments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tournaments_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "player_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tournaments_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
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
    Views: TeamOperationsViews;
    Functions: TeamOperationsFunctions & {
      accept_invitation: { Args: { p_token: string }; Returns: string };
      consent_status: { Args: Record<PropertyKey, never>; Returns: string };
      create_demo_team: { Args: { p_name: string; p_people: Json }; Returns: Json };
      delete_demo_team: { Args: { p_org: string }; Returns: undefined };
      seed_demo_activity: { Args: { p_org: string; p_rows: Json }; Returns: undefined };
      create_organization: {
        Args: { p_name: string; p_slug: string };
        Returns: {
          created_at: string;
          current_season_phase: Database["public"]["Enums"]["season_phase"];
          id: string;
          modules: string[];
          name: string;
          owner_id: string;
          plan_renews_at: string | null;
          plan_status: string | null;
          plan_tier: Database["public"]["Enums"]["plan_tier"];
          settings: NonNullable<Json>;
          slug: string;
          sport: string;
          stats_visibility: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          team_type: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "organizations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined };
      duplicate_program: {
        Args: { p_is_template: boolean; p_name: string; p_program_id: string };
        Returns: string;
      };
      get_consent_request: {
        Args: { p_token: string };
        Returns: {
          child_email: string;
          child_name: string;
          consented: boolean;
          email_matches: boolean;
          parent_email: string;
          revoked: boolean;
          teams: string[];
        }[];
      };
      get_invitation: {
        Args: { p_token: string };
        Returns: {
          email: string;
          email_matches: boolean;
          is_accepted: boolean;
          is_expired: boolean;
          org_name: string;
          player_name: string;
          role: Database["public"]["Enums"]["org_role"];
        }[];
      };
      give_parental_consent: {
        Args: { p_parent_name: string; p_token: string };
        Returns: undefined;
      };
      import_team_rows: {
        Args: { p_kind: string; p_org: string; p_rows: Json; p_season: string; p_source: string };
        Returns: Json;
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
      request_parental_consent: { Args: { p_parent_email: string }; Returns: string };
      revoke_parental_consent: { Args: { p_child: string }; Returns: undefined };
      save_box_score: {
        Args: { p_batting: Json; p_game_id: string; p_pitching: Json };
        Returns: undefined;
      };
      save_practice_blocks: { Args: { p_blocks: Json; p_plan_id: string }; Returns: undefined };
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
      start_thread: {
        Args: { p_body: string; p_member_ids: string[]; p_org_id: string; p_subject: string };
        Returns: string;
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
      game_kind: "league" | "non_league" | "scrimmage" | "tournament" | "playoff";
      game_status: "scheduled" | "live" | "final" | "postponed" | "canceled";
      home_away: "home" | "away" | "neutral";
      member_status: "active" | "inactive" | "injured";
      org_role: "admin" | "coach" | "trainer" | "player" | "parent";
      plan_tier: "free" | "pro" | "enterprise";
      player_position: "P" | "C" | "1B" | "2B" | "SS" | "3B" | "OF" | "DH" | "UTIL";
      practice_block_kind:
        | "warmup"
        | "throwing"
        | "defense"
        | "hitting"
        | "pitching"
        | "baserunning"
        | "conditioning"
        | "team"
        | "other";
      program_type: "strength" | "throwing" | "arm_care" | "hitting" | "conditioning" | "hybrid";
      season_phase: "off_season" | "pre_season" | "in_season" | "post_season";
      session_type:
        "strength" | "throwing" | "hitting" | "conditioning" | "recovery" | "practice" | "off";
      throwing_intensity: "low" | "moderate" | "high" | "max_effort";
      throwing_type: "long_toss" | "flat_ground" | "bullpen" | "live_abs" | "game" | "check_in";
      tracking_type: "weight_reps" | "reps" | "time" | "distance" | "distance_time";
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
      game_kind: ["league", "non_league", "scrimmage", "tournament", "playoff"],
      game_status: ["scheduled", "live", "final", "postponed", "canceled"],
      home_away: ["home", "away", "neutral"],
      member_status: ["active", "inactive", "injured"],
      org_role: ["admin", "coach", "trainer", "player", "parent"],
      plan_tier: ["free", "pro", "enterprise"],
      player_position: ["P", "C", "1B", "2B", "SS", "3B", "OF", "DH", "UTIL"],
      practice_block_kind: [
        "warmup",
        "throwing",
        "defense",
        "hitting",
        "pitching",
        "baserunning",
        "conditioning",
        "team",
        "other",
      ],
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
      tracking_type: ["weight_reps", "reps", "time", "distance", "distance_time"],
      video_status: ["pending", "reviewed"],
      video_type: ["hitting", "pitching", "fielding", "catching", "exercise_form", "other"],
      workout_status: ["completed", "partial", "skipped"],
    },
  },
} as const;
