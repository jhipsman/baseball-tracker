import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { readMetrics } from "@/constants/metrics";

export type AssessmentRow = {
  id: string;
  playerId: string;
  date: string;
  metrics: Record<string, number>;
  notes: string | null;
};

export async function loadAssessments(
  supabase: SupabaseClient<Database>,
  orgId: string,
  playerId?: string,
): Promise<AssessmentRow[]> {
  let q = supabase
    .from("assessments")
    .select("id, player_id, assessment_date, data, notes")
    .eq("org_id", orgId)
    .order("assessment_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(2000);
  if (playerId) q = q.eq("player_id", playerId);
  const { data, error } = await q;
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    playerId: r.player_id,
    date: r.assessment_date,
    metrics: readMetrics(r.data),
    notes: r.notes,
  }));
}

/** metric key -> [{date, value}] (oldest first), for one player's rows. */
export function seriesByMetric(rows: AssessmentRow[]) {
  const out = new Map<string, { date: string; value: number }[]>();
  for (const r of rows.toSorted((a, b) => a.date.localeCompare(b.date))) {
    for (const [k, v] of Object.entries(r.metrics)) {
      out.set(k, [...(out.get(k) ?? []), { date: r.date, value: v }]);
    }
  }
  return out;
}

/** Latest value per metric per player. */
export function latestByPlayer(rows: AssessmentRow[]) {
  const out = new Map<string, Record<string, number>>();
  // rows are newest first
  for (const r of rows) {
    const cur = out.get(r.playerId) ?? {};
    for (const [k, v] of Object.entries(r.metrics)) if (!(k in cur)) cur[k] = v;
    out.set(r.playerId, cur);
  }
  return out;
}
