"use server";

import type { SaveResult } from "@/components/workout-builder/builder";
import type { toPayload } from "@/components/workout-builder/reducer";
import { requireActiveOrg } from "@/lib/org";
import type { Json } from "@/types/database";

const MAX_WEEKS = 52;
const MAX_DAYS = 14;
const MAX_EXERCISES = 80;

export async function saveProgramStructure(
  programId: string,
  weeks: ReturnType<typeof toPayload>,
): Promise<SaveResult> {
  const { supabase, isStaff } = await requireActiveOrg();
  if (!isStaff) return { error: "You don't have permission to edit programs." };

  if (!Array.isArray(weeks) || weeks.length === 0 || weeks.length > MAX_WEEKS) {
    return { error: `A program needs between 1 and ${MAX_WEEKS} weeks.` };
  }
  for (const w of weeks) {
    if (!Array.isArray(w.days) || w.days.length > MAX_DAYS) {
      return { error: `A week can have at most ${MAX_DAYS} days.` };
    }
    for (const d of w.days) {
      if (!Array.isArray(d.exercises) || d.exercises.length > MAX_EXERCISES) {
        return { error: `A day can have at most ${MAX_EXERCISES} exercises.` };
      }
    }
  }

  const { error } = await supabase.rpc("save_program_structure", {
    p_program_id: programId,
    p_weeks: weeks as unknown as Json,
  });
  return error ? { error: error.message } : {};
}
