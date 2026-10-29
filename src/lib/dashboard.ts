import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { hasModule } from "@/constants/modules";
import { addDays } from "@/lib/schedule";
import { loadTeam } from "@/lib/team";
import { loadBirthDates, loadThrowing } from "@/lib/throwing";
import { pendingVideoCount } from "@/lib/videos";
import { loadPractices } from "@/lib/practices";

/** Independent dashboard reads start together; team logs alone depend on assignment IDs.
 * Nothing is cached across requests/users, so workload and compliance remain current.
 */
export async function loadDashboard(
  supabase: SupabaseClient<Database>,
  org: { id: string; modules: readonly string[] | null },
  today: string,
) {
  const health = hasModule(org.modules, "health");
  const [
    team,
    { data: recent },
    throwRows,
    births,
    exercises,
    members,
    programs,
    videosToReview,
    [nextPractice],
    { data: assignmentRows },
    { data: assessmentRows },
  ] = await Promise.all([
    loadTeam(supabase, org.id, addDays(today, -6), today, today, {
      includeGroups: false,
      includeLastLog: false,
    }),
    supabase
      .from("workout_logs")
      .select(
        `id, date_completed, status, overall_rpe, notes, day_name, player_id,
       player:profiles!workout_logs_player_id_fkey (full_name, email),
       assignment:program_assignments!inner (program:programs!inner (name, org_id))`,
      )
      .eq("assignment.program.org_id", org.id)
      .order("created_at", { ascending: false })
      .limit(8),
    health ? loadThrowing(supabase, org.id, addDays(today, -60)) : Promise.resolve([]),
    health ? loadBirthDates(supabase, org.id) : Promise.resolve(new Map<string, string | null>()),
    supabase.from("exercises").select("id", { count: "exact", head: true }),
    supabase
      .from("org_memberships")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id),
    supabase.from("programs").select("id", { count: "exact", head: true }).eq("org_id", org.id),
    hasModule(org.modules, "videos") ? pendingVideoCount(supabase, org.id) : Promise.resolve(0),
    hasModule(org.modules, "practices")
      ? loadPractices(supabase, org.id, today, null, { limit: 1 })
      : Promise.resolve([]),
    // Getting-started only needs existence, not an exact count of every record.
    supabase
      .from("program_assignments")
      .select("id, program:programs!inner (org_id)")
      .eq("program.org_id", org.id)
      .limit(1),
    supabase.from("assessments").select("id").eq("org_id", org.id).limit(1),
  ]);
  return {
    team,
    recent,
    throwRows,
    births,
    exercises,
    members,
    programs,
    videosToReview,
    nextPractice,
    assignmentCount: assignmentRows?.length ?? 0,
    assessmentCount: assessmentRows?.length ?? 0,
  };
}
