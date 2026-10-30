import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { STARTER_TEMPLATES } from "@/lib/starter-templates";

/** Add the built-in starter program templates an org doesn't have yet. Returns name → program id. */
export async function insertStarterTemplates(
  supabase: SupabaseClient<Database>,
  orgId: string,
  userId: string,
) {
  const [{ data: existing }, { data: library }] = await Promise.all([
    supabase.from("programs").select("name").eq("org_id", orgId).eq("is_template", true),
    supabase.from("exercises").select("id, name").is("org_id", null),
  ]);
  const have = new Set((existing ?? []).map((p) => p.name));
  const idOf = new Map((library ?? []).map((e) => [e.name, e.id]));
  const created = new Map<string, string>();

  for (const t of STARTER_TEMPLATES) {
    if (have.has(t.name)) continue;
    const { data: program, error } = await supabase
      .from("programs")
      .insert({
        org_id: orgId,
        name: t.name,
        description: t.description,
        program_type: t.type,
        season_phase: t.phase,
        duration_weeks: t.weeks.length,
        is_template: true,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const weeks = t.weeks.map((w, wi) => ({
      id: crypto.randomUUID(),
      week_number: wi + 1,
      label: w.label ?? "",
      days: w.days.map((d, di) => ({
        id: crypto.randomUUID(),
        day_number: di + 1,
        name: d.name,
        session_type: d.session,
        sort_order: di,
        exercises: d.exercises
          .filter((e) => idOf.has(e.name))
          .map((e, ei) => ({
            id: crypto.randomUUID(),
            exercise_id: idOf.get(e.name),
            sort_order: ei,
            sets: e.sets,
            reps: e.reps,
            intensity: e.intensity ?? "",
            rest_seconds: e.rest ?? null,
            notes: e.notes ?? "",
          })),
      })),
    }));
    const { error: saveError } = await supabase.rpc("save_program_structure", {
      p_program_id: program.id,
      p_weeks: weeks,
    });
    if (saveError) throw new Error(saveError.message);
    created.set(t.name, program.id);
  }
  return created;
}
