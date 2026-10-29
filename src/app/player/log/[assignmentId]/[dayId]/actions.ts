"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/org";
import type { Enums, Json } from "@/types/database";
import { isDistanceUnit, type LoggedSet } from "@/lib/sets-format";

export type { LoggedSet };

export type WorkoutLogInput = {
  assignmentId: string;
  dayId: string;
  date: string;
  status: Enums<"workout_status">;
  durationMinutes: number | null;
  overallRpe: number | null;
  notes: string;
  exercises: { programExerciseId: string; sortOrder: number; notes: string; sets: LoggedSet[] }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = new Set(["completed", "partial", "skipped"]);

function intOrNull(v: unknown, min: number, max: number) {
  const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null;
}

function numOrNull(v: unknown, min: number, max: number) {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : null;
}

export async function saveWorkoutLog(input: WorkoutLogInput): Promise<{ error?: string }> {
  const { supabase } = await requireUser();

  if (!UUID.test(input.assignmentId) || !UUID.test(input.dayId))
    return { error: "Invalid workout." };
  if (!STATUSES.has(input.status)) return { error: "Invalid status." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: "Invalid date." };
  if (!Array.isArray(input.exercises) || input.exercises.length > 100) {
    return { error: "Too many exercises." };
  }

  const exercises = input.exercises
    .filter((e) => UUID.test(e.programExerciseId) && Array.isArray(e.sets))
    .map((e, i) => ({
      program_exercise_id: e.programExerciseId,
      sort_order: intOrNull(e.sortOrder, 0, 10_000) ?? i,
      notes: String(e.notes ?? "").slice(0, 2000),
      sets: e.sets.slice(0, 50).map((s, j) => {
        const set: LoggedSet = {
          set: j + 1,
          reps:
            typeof s.reps === "number"
              ? intOrNull(s.reps, 0, 1000)
              : String(s.reps ?? "").slice(0, 16) || null,
          weight: numOrNull(s.weight, 0, 2000),
          rpe: numOrNull(s.rpe, 1, 10),
          done: Boolean(s.done),
        };
        // Time / distance exercises (Phase 7). Only stored when present so
        // weight × reps rows keep their original shape.
        const time = numOrNull(s.time_s, 0, 86_400);
        const distance = numOrNull(s.distance, 0, 100_000);
        if (time != null) set.time_s = time;
        if (distance != null) {
          set.distance = distance;
          set.distance_unit = isDistanceUnit(s.distance_unit) ? s.distance_unit : "yd";
        }
        return set;
      }),
    }));

  const { error } = await supabase.rpc("save_workout_log", {
    p_assignment_id: input.assignmentId,
    p_day_id: input.dayId,
    p_date: input.date,
    p_status: input.status,
    p_duration_minutes: intOrNull(input.durationMinutes, 0, 600) as number,
    p_overall_rpe: intOrNull(input.overallRpe, 1, 10) as number,
    p_notes: String(input.notes ?? "").slice(0, 4000),
    p_exercises: exercises as unknown as Json,
  });
  if (error) {
    // Players never see raw database text; the details go to the server log.
    console.error("save_workout_log failed", error);
    return {
      error:
        "We couldn't save your workout. Your sets are still here on this phone — check your signal and try again.",
    };
  }

  revalidatePath("/player");
  revalidatePath("/player/history");
  redirect(`/player?saved=${input.status}`);
}
