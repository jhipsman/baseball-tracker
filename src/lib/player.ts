import "server-only";

import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scheduleFor, todayIn, type Schedule } from "@/lib/schedule";
import type { Database, Enums } from "@/types/database";

export const TZ_COOKIE = "dp_tz";

/** The player's local date (YYYY-MM-DD), from the time zone cookie set by <TimezoneSync>. */
export async function playerToday() {
  const tz = (await cookies()).get(TZ_COOKIE)?.value;
  return { today: todayIn(tz ? decodeURIComponent(tz) : undefined), tz };
}

export type PlayerDay = {
  id: string;
  name: string;
  sessionType: Enums<"session_type">;
  dayOfWeek: number | null;
  exerciseCount: number;
  log: { id: string; status: Enums<"workout_status">; date: string } | null;
};

export type PlayerAssignment = {
  id: string;
  startDate: string;
  programId: string;
  programName: string;
  weeks: { label: string | null; days: PlayerDay[] }[];
  schedule: Schedule;
};

/** The player's active assignments with program structure, logs, and today's schedule. */
export async function loadPlayerAssignments(
  supabase: SupabaseClient<Database>,
  playerId: string,
  orgId: string,
  today: string,
): Promise<PlayerAssignment[]> {
  const { data: assignments, error } = await supabase
    .from("program_assignments")
    .select(
      `id, start_date,
       program:programs!inner (id, name, org_id,
         program_weeks (id, week_number, label,
           program_days (id, name, day_number, day_of_week, session_type, sort_order,
             program_exercises (count))))`,
    )
    .eq("player_id", playerId)
    .eq("status", "active")
    .eq("program.org_id", orgId)
    .order("start_date");
  if (error) throw error;
  if (assignments.length === 0) return [];

  const { data: logs, error: logError } = await supabase
    .from("workout_logs")
    .select("id, program_assignment_id, program_day_id, status, date_completed")
    .in(
      "program_assignment_id",
      assignments.map((a) => a.id),
    );
  if (logError) throw logError;

  return assignments.map((a) => {
    const logByDay = new Map(
      logs
        .filter((l) => l.program_assignment_id === a.id && l.program_day_id)
        .map((l) => [l.program_day_id!, l]),
    );
    const weeks = a.program.program_weeks
      .toSorted((x, y) => x.week_number - y.week_number)
      .map((w) => ({
        label: w.label,
        days: w.program_days
          .toSorted((x, y) => x.sort_order - y.sort_order)
          .map((d): PlayerDay => {
            const log = logByDay.get(d.id);
            return {
              id: d.id,
              name: d.name || `Day ${d.day_number}`,
              sessionType: d.session_type,
              dayOfWeek: d.day_of_week,
              exerciseCount: d.program_exercises[0]?.count ?? 0,
              log: log ? { id: log.id, status: log.status, date: log.date_completed } : null,
            };
          }),
      }));
    const logged = new Set(logByDay.keys());
    return {
      id: a.id,
      startDate: a.start_date,
      programId: a.program.id,
      programName: a.program.name,
      weeks,
      schedule: scheduleFor(a.start_date, today, weeks, logged),
    };
  });
}
