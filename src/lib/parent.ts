import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { requireActiveOrg } from "@/lib/org";
import { buildEntries, type CalendarAssignment, type CalendarEntry } from "@/lib/calendar";

type Client = SupabaseClient<Database>;

export type Child = { id: string; name: string; firstName: string };

const displayName = (p: { full_name: string | null; email: string } | null | undefined) =>
  p?.full_name || p?.email || "Your player";

/**
 * The signed-in parent and the players they're linked to in the active org
 * (only players still on the team). Redirects anyone who isn't a parent there.
 */
export const requireParent = cache(async () => {
  const ctx = await requireActiveOrg();
  if (ctx.membership.role !== "parent") redirect("/");
  const { supabase, user, org } = ctx;

  const { data: links } = await supabase
    .from("parent_links")
    .select("player_id")
    .eq("org_id", org.id)
    .eq("parent_id", user.id);
  const ids = [...new Set((links ?? []).map((l) => l.player_id))];

  const { data: players } = ids.length
    ? await supabase
        .from("org_memberships")
        .select("profile_id, profile:profiles (full_name, email)")
        .eq("org_id", org.id)
        .eq("role", "player")
        .in("profile_id", ids)
    : { data: [] };

  const children: Child[] = (players ?? [])
    .map((p) => {
      const name = displayName(p.profile);
      return { id: p.profile_id, name, firstName: name.split(/[\s@]/)[0] || name };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { ...ctx, children };
});

/** The child picked with `?player=`, falling back to the first linked child. */
export function pickChild(children: Child[], param: string | string[] | undefined) {
  const wanted = typeof param === "string" ? param : undefined;
  return children.find((c) => c.id === wanted) ?? children[0] ?? null;
}

/** Calendar entries (logged + planned/missed) for one player between from–to. */
export async function loadChildEntries(
  supabase: Client,
  orgId: string,
  playerId: string,
  from: string,
  to: string,
  today: string,
): Promise<{ entries: CalendarEntry[]; assignments: CalendarAssignment[] }> {
  const { data: rows, error } = await supabase
    .from("program_assignments")
    .select(
      `id, player_id, status, start_date,
       program:programs!inner (id, name, org_id,
         program_weeks (week_number,
           program_days (id, name, day_number, day_of_week, session_type, sort_order)))`,
    )
    .eq("player_id", playerId)
    .eq("program.org_id", orgId);
  if (error) throw error;

  const assignments: CalendarAssignment[] = rows.map((a) => ({
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
  if (assignments.length === 0) return { entries: [], assignments };

  const { data: logs, error: logError } = await supabase
    .from("workout_logs")
    .select("program_assignment_id, program_day_id, day_name, status, date_completed")
    .eq("player_id", playerId)
    .in(
      "program_assignment_id",
      assignments.map((a) => a.id),
    )
    .gte("date_completed", from)
    .lte("date_completed", to);
  if (logError) throw logError;

  const entries = buildEntries(
    assignments,
    logs.map((l) => ({
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
  return { entries, assignments };
}

export type LinkedParent = { linkId: string; parentId: string; name: string; email: string };
export type ParentInvite = {
  id: string;
  email: string;
  token: string;
  expired: boolean;
  playerId: string;
  invitedBy: string | null;
};

/**
 * Parents linked to a player, and pending parent invitations for them.
 * Works for staff (any player) and for the player themselves (RLS).
 */
export async function loadParentsOf(supabase: Client, orgId: string, playerId: string) {
  const [{ data: links }, { data: invites }] = await Promise.all([
    supabase
      .from("parent_links")
      .select("id, parent_id, parent:profiles!parent_links_parent_id_fkey (full_name, email)")
      .eq("org_id", orgId)
      .eq("player_id", playerId)
      .order("created_at"),
    supabase
      .from("org_invitations")
      .select("id, email, token, expires_at, player_id, invited_by")
      .eq("org_id", orgId)
      .eq("role", "parent")
      .eq("player_id", playerId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  // Only count parents who are still members of the team.
  const parentIds = (links ?? []).map((l) => l.parent_id);
  const { data: members } = parentIds.length
    ? await supabase
        .from("org_memberships")
        .select("profile_id")
        .eq("org_id", orgId)
        .eq("role", "parent")
        .in("profile_id", parentIds)
    : { data: [] };
  const active = new Set((members ?? []).map((m) => m.profile_id));

  const parents: LinkedParent[] = (links ?? [])
    .filter((l) => active.has(l.parent_id))
    .map((l) => ({
      linkId: l.id,
      parentId: l.parent_id,
      name: displayName(l.parent),
      email: l.parent?.email ?? "",
    }));
  const now = Date.now();
  const pending: ParentInvite[] = (invites ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    token: i.token,
    expired: new Date(i.expires_at).getTime() < now,
    playerId: i.player_id ?? playerId,
    invitedBy: i.invited_by,
  }));
  return { parents, pending };
}
