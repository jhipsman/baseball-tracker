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
