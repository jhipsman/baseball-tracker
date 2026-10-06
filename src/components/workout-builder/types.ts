import type { Enums, Tables } from "@/types/database";

export type GroupType = Enums<"exercise_group_type">;
export type SessionType = Enums<"session_type">;

export type LibraryExercise = Pick<
  Tables<"exercises">,
  "id" | "name" | "category" | "muscle_groups" | "equipment" | "is_custom"
>;

/** One exercise slot inside a day (a program_exercises row). */
export type BuilderItem = {
  id: string;
  exerciseId: string;
  groupId: string | null;
  groupType: GroupType | null;
  sets: number | null;
  reps: string;
  intensity: string;
  tempo: string;
  restSeconds: number | null;
  notes: string;
};

export type BuilderDay = {
  id: string;
  name: string;
  sessionType: SessionType;
  dayOfWeek: number | null;
  notes: string;
  items: BuilderItem[];
};

export type BuilderWeek = {
  id: string;
  label: string;
  notes: string;
  days: BuilderDay[];
};

export type BuilderState = {
  weeks: BuilderWeek[];
  activeWeek: number;
  /** Item ids selected for grouping; always within a single day. */
  selection: string[];
};
