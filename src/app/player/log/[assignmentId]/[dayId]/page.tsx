import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { blockLabels } from "@/components/workout-builder/reducer";
import { summarize } from "@/components/workout-builder/format";
import { SESSION_LABELS } from "@/constants";
import type { LoggedSet } from "./actions";
import { LogForm, type ExistingLog, type LogItem } from "./log-form";

export const metadata: Metadata = { title: "Log workout" };

export default async function LogWorkoutPage({
  params,
}: PageProps<"/player/log/[assignmentId]/[dayId]">) {
  const { assignmentId, dayId } = await params;
  const { supabase, user } = await requireActiveOrg();

  const [{ data: assignment }, { data: day }] = await Promise.all([
    supabase
      .from("program_assignments")
      .select("id, player_id, program_id, program:programs (name)")
      .eq("id", assignmentId)
      .maybeSingle(),
    supabase
      .from("program_days")
      .select(
        `id, name, day_number, session_type, notes,
         week:program_weeks!inner (program_id, week_number, label),
         program_exercises (id, exercise_id, sort_order, group_id, group_type,
           sets, reps, intensity, tempo, rest_seconds, notes)`,
      )
      .eq("id", dayId)
      .maybeSingle(),
  ]);
  if (
    !assignment ||
    !day ||
    assignment.player_id !== user.id ||
    day.week.program_id !== assignment.program_id
  ) {
    notFound();
  }

  const programExercises = day.program_exercises.toSorted((a, b) => a.sort_order - b.sort_order);
  const exerciseIds = [...new Set(programExercises.map((e) => e.exercise_id))];

  const [{ data: exercises }, { data: existingLog }, { data: recent }] = await Promise.all([
    exerciseIds.length
      ? supabase.from("exercises").select("id, name, category, instructions").in("id", exerciseIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("workout_logs")
      .select(
        "id, status, duration_minutes, overall_rpe, notes, date_completed, exercise_logs (program_exercise_id, sets_completed, notes)",
      )
      .eq("program_assignment_id", assignmentId)
      .eq("program_day_id", dayId)
      .maybeSingle(),
    // Recent logs for "last time" hints.
    exerciseIds.length
      ? supabase
          .from("workout_logs")
          .select("id, date_completed, exercise_logs (exercise_id, sets_completed)")
          .eq("player_id", user.id)
          .neq("status", "skipped")
          .order("date_completed", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [] }),
  ]);

  const byId = new Map((exercises ?? []).map((e) => [e.id, e]));
  const lastTime = new Map<string, { date: string; sets: LoggedSet[] }>();
  for (const log of recent ?? []) {
    if (log.id === existingLog?.id) continue;
    for (const el of log.exercise_logs) {
      const sets = el.sets_completed as unknown as LoggedSet[];
      if (!lastTime.has(el.exercise_id) && Array.isArray(sets) && sets.length > 0) {
        lastTime.set(el.exercise_id, { date: log.date_completed, sets });
      }
    }
  }

  const builderItems = programExercises.map((e) => ({
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
  }));
  const labels = blockLabels(builderItems);

  const items: LogItem[] = programExercises.map((e, i) => {
    const ex = byId.get(e.exercise_id);
    return {
      programExerciseId: e.id,
      name: ex?.name ?? "Exercise",
      category: ex?.category ?? null,
      label: labels[i],
      groupType: e.group_type,
      groupStart: !!e.group_id && programExercises[i - 1]?.group_id !== e.group_id,
      prescription: summarize(builderItems[i]),
      coachNotes: e.notes,
      instructions: ex?.instructions ?? null,
      prescribedSets: e.sets,
      prescribedReps: e.reps ?? "",
      lastTime: lastTime.get(e.exercise_id) ?? null,
    };
  });

  const existing: ExistingLog | null = existingLog
    ? {
        status: existingLog.status,
        durationMinutes: existingLog.duration_minutes,
        overallRpe: existingLog.overall_rpe,
        notes: existingLog.notes ?? "",
        date: existingLog.date_completed,
        exercises: Object.fromEntries(
          existingLog.exercise_logs
            .filter((el) => el.program_exercise_id)
            .map((el) => [
              el.program_exercise_id!,
              { sets: el.sets_completed as unknown as LoggedSet[], notes: el.notes ?? "" },
            ]),
        ),
      }
    : null;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/player" className="text-sm font-medium text-zinc-500">
          ← Today
        </Link>
        <p className="mt-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          {assignment.program.name} · Week {day.week.week_number}
          {day.week.label ? ` · ${day.week.label}` : ""}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {day.name || `Day ${day.day_number}`}
        </h1>
        <p className="text-sm text-zinc-500">{SESSION_LABELS[day.session_type]}</p>
        {existing ? (
          <p className="mt-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
            Logged on {existing.date} as <strong>{existing.status}</strong>. Changes update that
            log.
          </p>
        ) : null}
        {day.notes ? <p className="mt-2 text-sm text-zinc-600">{day.notes}</p> : null}
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-sm text-zinc-500 ring-1 ring-zinc-200">
          No exercises listed for this day. Mark it done when you&apos;ve finished the session.
        </p>
      ) : null}
      <LogForm assignmentId={assignmentId} dayId={dayId} items={items} existing={existing} />
    </div>
  );
}
