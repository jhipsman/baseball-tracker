import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums } from "@/types/database";
import type { ThrowLog } from "./workload";

export type ThrowingRow = ThrowLog & {
  id: string;
  playerId: string;
  loggedBy: string | null;
  maxDistance: number | null;
  intensity: Enums<"throwing_intensity"> | null;
  pitchesByType: Record<string, number> | null;
  notes: string | null;
};

/** Throwing logs for an org (optionally one player) on or after `from`, newest first. */
export async function loadThrowing(
  supabase: SupabaseClient<Database>,
  orgId: string,
  from: string,
  playerId?: string,
): Promise<ThrowingRow[]> {
  let q = supabase
    .from("throwing_logs")
    .select(
      "id, player_id, logged_by, date, throwing_type, pitch_count, max_distance_ft, intensity, pitches_by_type, arm_feel, notes",
    )
    .eq("org_id", orgId)
    .gte("date", from)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(5000);
  if (playerId) q = q.eq("player_id", playerId);
  const { data, error } = await q;
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    playerId: r.player_id,
    loggedBy: r.logged_by,
    date: r.date,
    type: r.throwing_type,
    pitches: r.pitch_count,
    armFeel: r.arm_feel,
    maxDistance: r.max_distance_ft,
    intensity: r.intensity,
    pitchesByType: (r.pitches_by_type as Record<string, number> | null) ?? null,
    notes: r.notes,
  }));
}

/** Birthdates for the org's players (null when not set). */
export async function loadBirthDates(supabase: SupabaseClient<Database>, orgId: string) {
  const { data } = await supabase
    .from("org_memberships")
    .select("profile_id, profile:profiles (birth_date)")
    .eq("org_id", orgId)
    .eq("role", "player");
  return new Map((data ?? []).map((m) => [m.profile_id, m.profile.birth_date]));
}
