export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
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
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
        };
        Update: {
          avatar_url?: string | null;
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
    };
    Enums: {
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
    },
  },
} as const;
