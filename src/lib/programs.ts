import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BuilderWeek } from "@/components/workout-builder/types";
import type { Database } from "@/types/database";

const PROGRAM_TREE = `
  id, org_id, name, description, program_type, season_phase, duration_weeks, is_template,
  created_at, updated_at,
  program_weeks (
    id, week_number, label, notes,
    program_days (
      id, day_number, day_of_week, name, session_type, notes, sort_order,
      program_exercises (
        id, exercise_id, sort_order, group_id, group_type,
        sets, reps, intensity, tempo, rest_seconds, notes
      )
    )
  )
`;

/** A program with its weeks → days → exercises, sorted for display. */
export async function loadProgramTree(supabase: SupabaseClient<Database>, programId: string) {
  const { data, error } = await supabase
    .from("programs")
    .select(PROGRAM_TREE)
    .eq("id", programId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const weeks = data.program_weeks
    .toSorted((a, b) => a.week_number - b.week_number)
    .map((w) => ({
      ...w,
      program_days: w.program_days
        .toSorted((a, b) => a.sort_order - b.sort_order || a.day_number - b.day_number)
        .map((d) => ({
          ...d,
          program_exercises: d.program_exercises.toSorted((a, b) => a.sort_order - b.sort_order),
        })),
    }));
  return { ...data, program_weeks: weeks };
}

export type ProgramTree = NonNullable<Awaited<ReturnType<typeof loadProgramTree>>>;

export function toBuilderWeeks(program: ProgramTree): BuilderWeek[] {
  const weeks: BuilderWeek[] = program.program_weeks.map((w) => ({
    id: w.id,
    label: w.label ?? "",
    notes: w.notes ?? "",
    days: w.program_days.map((d) => ({
      id: d.id,
      name: d.name,
      sessionType: d.session_type,
      dayOfWeek: d.day_of_week,
      notes: d.notes ?? "",
      items: d.program_exercises.map((e) => ({
        id: e.id,
        exerciseId: e.exercise_id,
        groupId: e.group_id,
        groupType: e.group_type,
        sets: e.sets,
        reps: e.reps ?? "",
        intensity: e.intensity ?? "",
        tempo: e.tempo ?? "",
        restSeconds: e.rest_seconds,
        notes: e.notes ?? "",
      })),
    })),
  }));

  if (weeks.length === 0) {
    weeks.push({
      id: crypto.randomUUID(),
      label: "",
      notes: "",
      days: [
        {
          id: crypto.randomUUID(),
          name: "Day 1",
          sessionType: "strength",
          dayOfWeek: null,
          notes: "",
          items: [],
        },
      ],
    });
  }
  return weeks;
}
