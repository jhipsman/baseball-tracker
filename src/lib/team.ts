import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums } from "@/types/database";
import { buildEntries, type CalendarAssignment, type CalendarEntry } from "./calendar";

export type TeamPlayer = {
  id: string;
  name: string;
  email: string;
  position: Enums<"player_position"> | null;
  jersey: number | null;
  status: Enums<"member_status">;
  detail: string;
};

export type TeamData = {
  players: TeamPlayer[];
  groups: { id: string; name: string; memberIds: string[] }[];
  assignments: CalendarAssignment[];
  entries: CalendarEntry[];
  /** Most recent log date per player (any time, not just the range). */
  lastLogDate: Map<string, string>;
};

/**
 * Everything the coach views need about the roster's schedule: players, groups,
 * assignments with program structure, and calendar entries between from–to.
 */
export async function loadTeam(
  supabase: SupabaseClient<Database>,
  orgId: string,
  from: string,
  to: string,
  today: string,
): Promise<TeamData> {
  const [{ data: assignmentRows, error }, { data: playerRows }, { data: groupRows }] =
    await Promise.all([
      supabase
        .from("program_assignments")
        .select(
          `id, player_id, status, start_date,
           program:programs!inner (id, name, org_id,
             program_weeks (week_number,
               program_days (id, name, day_number, day_of_week, session_type, sort_order)))`,
        )
        .eq("program.org_id", orgId),
      supabase
        .from("org_memberships")
        .select("profile_id, position, jersey_number, status, profile:profiles (full_name, email)")
        .eq("org_id", orgId)
        .eq("role", "player"),
      supabase
        .from("player_groups")
        .select("id, name, player_group_members (profile_id)")
        .eq("org_id", orgId)
        .order("name"),
    ]);
  if (error) throw error;

  const assignments: CalendarAssignment[] = assignmentRows.map((a) => ({
    id: a.id,
    playerId: a.player_id,
    status: a.status,
    startDate: a.start_date,
    programId: a.program.id,
    programName: a.program.name,
    weeks: a.program.program_weeks
      .toSorted((p, q) => p.week_number - q.week_number)
      .map((w) => ({
        days: w.program_days
          .toSorted((p, q) => p.sort_order - q.sort_order)
          .map((d) => ({
            id: d.id,
            dayOfWeek: d.day_of_week,
            name: d.name || `Day ${d.day_number}`,
            sessionType: d.session_type,
          })),
      })),
  }));

  const assignmentIds = assignments.map((a) => a.id);
  const [{ data: logRows }, { data: lastRows }] = assignmentIds.length
    ? await Promise.all([
        supabase
          .from("workout_logs")
          .select("program_assignment_id, program_day_id, day_name, status, date_completed")
          .in("program_assignment_id", assignmentIds)
          .gte("date_completed", from)
          .lte("date_completed", to),
        supabase
          .from("workout_logs")
          .select("player_id, date_completed")
          .in("program_assignment_id", assignmentIds)
          .neq("status", "skipped")
          .order("date_completed", { ascending: false })
          .limit(1000),
      ])
    : [{ data: [] }, { data: [] }];

  const lastLogDate = new Map<string, string>();
  for (const r of lastRows ?? []) {
    if (!lastLogDate.has(r.player_id)) lastLogDate.set(r.player_id, r.date_completed);
  }

  const players: TeamPlayer[] = (playerRows ?? [])
    .map((p) => ({
      id: p.profile_id,
      name: p.profile.full_name || p.profile.email,
      email: p.profile.email,
      position: p.position,
      jersey: p.jersey_number,
      status: p.status,
      detail: [p.position, p.jersey_number != null ? `#${p.jersey_number}` : null]
        .filter(Boolean)
        .join(" "),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const entries = buildEntries(
    assignments,
    (logRows ?? []).map((l) => ({
      assignmentId: l.program_assignment_id,
      dayId: l.program_day_id,
      dayName: l.day_name,
      status: l.status,
      date: l.date_completed,
    })),
    from,
    to,
    today,
  );

  return {
    players,
    groups: (groupRows ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      memberIds: g.player_group_members.map((m) => m.profile_id),
    })),
    assignments,
    entries,
    lastLogDate,
  };
}
