import { Constants, type Enums } from "@/types/database";

// Enum values come straight from the generated DB types so they never drift.
export const EXERCISE_CATEGORIES = Constants.public.Enums.exercise_category;
export const ORG_ROLES = Constants.public.Enums.org_role;
export const PLAYER_POSITIONS = Constants.public.Enums.player_position;
export const PROGRAM_TYPES = Constants.public.Enums.program_type;
export const SEASON_PHASES = Constants.public.Enums.season_phase;
export const SESSION_TYPES = Constants.public.Enums.session_type;
export const EXERCISE_GROUP_TYPES = Constants.public.Enums.exercise_group_type;

export type ExerciseCategory = Enums<"exercise_category">;
export type OrgRole = Enums<"org_role">;

// Must match the check constraints on public.exercises.
export const MUSCLE_GROUPS = [
  "quads",
  "hamstrings",
  "glutes",
  "chest",
  "back",
  "shoulders",
  "arms",
  "core",
  "full_body",
] as const;

export const EQUIPMENT = [
  "barbell",
  "dumbbell",
  "kettlebell",
  "band",
  "cable",
  "bodyweight",
  "machine",
  "med_ball",
  "plyo_box",
  "trap_bar",
  "landmine",
  "sled",
  "foam_roller",
  "pull_up_bar",
  "baseball",
  "weighted_ball",
  "bat",
  "tee",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];
export type Equipment = (typeof EQUIPMENT)[number];

export const STAFF_ROLES: readonly OrgRole[] = ["admin", "coach", "trainer"];

/**
 * Roles that can be invited. Parent invites also name the player they follow;
 * coaches and trainers may invite parents, every other role is admin-only.
 */
export const INVITABLE_ROLES: readonly OrgRole[] = [
  "player",
  "parent",
  "coach",
  "trainer",
  "admin",
];

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  strength: "Strength",
  power: "Power",
  mobility: "Mobility",
  arm_care: "Arm Care",
  conditioning: "Conditioning",
  plyometric: "Plyometric",
  speed: "Speed",
  throwing: "Throwing",
  hitting: "Hitting",
};

export const ROLE_LABELS: Record<OrgRole, string> = {
  admin: "Admin",
  coach: "Coach",
  trainer: "Trainer",
  player: "Player",
  parent: "Parent",
};

/** "full_body" → "Full body" */
export function humanize(value: string) {
  const s = value.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Accent per category, for fast visual scanning in the builder. */
export const CATEGORY_DOT: Record<ExerciseCategory, string> = {
  strength: "bg-sky-500",
  power: "bg-orange-500",
  mobility: "bg-teal-500",
  arm_care: "bg-rose-500",
  conditioning: "bg-amber-500",
  plyometric: "bg-violet-500",
  speed: "bg-lime-500",
  throwing: "bg-red-600",
  hitting: "bg-indigo-500",
};

export const SESSION_LABELS: Record<Enums<"session_type">, string> = {
  strength: "Strength",
  throwing: "Throwing",
  hitting: "Hitting",
  conditioning: "Conditioning",
  recovery: "Recovery",
  practice: "Practice",
  off: "Off",
};

export const GROUP_LABELS: Record<Enums<"exercise_group_type">, string> = {
  superset: "Superset",
  circuit: "Circuit",
  emom: "EMOM",
  amrap: "AMRAP",
};

export const PROGRAM_TYPE_LABELS: Record<Enums<"program_type">, string> = {
  strength: "Strength",
  throwing: "Throwing",
  arm_care: "Arm Care",
  hitting: "Hitting",
  conditioning: "Conditioning",
  hybrid: "Hybrid",
};

export const SEASON_PHASE_LABELS: Record<Enums<"season_phase">, string> = {
  off_season: "Off-season",
  pre_season: "Pre-season",
  in_season: "In-season",
  post_season: "Post-season",
};

export const DAY_OF_WEEK_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// ---------------------------------------------------------------------------
// Exercise tracking types (how a set is logged)
// ---------------------------------------------------------------------------

export const TRACKING_TYPES = Constants.public.Enums.tracking_type;
export type TrackingType = Enums<"tracking_type">;

export const TRACKING_LABELS: Record<TrackingType, string> = {
  weight_reps: "Weight × reps",
  reps: "Reps only",
  time: "Time",
  distance: "Distance",
  distance_time: "Distance + time",
};

/** One-line explanation shown under the "How it's tracked" select. */
export const TRACKING_HINTS: Record<TrackingType, string> = {
  weight_reps: "Players log reps, weight, and RPE for each set (barbell and dumbbell lifts).",
  reps: "Players log reps only (push-ups, jumps, band work, med ball throws).",
  time: "Players log seconds per rep, e.g. 7.12 (sprints, shuttles, holds). Lower is better.",
  distance: "Players log how far in ft, yd, or m (carries, sled pushes, long toss).",
  distance_time: "Players log the distance and the time it took (e.g. a 500 m row).",
};

/** Short chip for library cards. Weight × reps is the default, so it gets none. */
export const TRACKING_CHIPS: Record<TrackingType, string | null> = {
  weight_reps: null,
  reps: "# Reps",
  time: "⏱ Time",
  distance: "↔ Distance",
  distance_time: "⏱ Dist + time",
};

export const DISTANCE_UNITS = ["yd", "ft", "m"] as const;
export type DistanceUnit = (typeof DISTANCE_UNITS)[number];
