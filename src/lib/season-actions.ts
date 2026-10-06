"use server";

import { revalidatePath } from "next/cache";
import { requireActiveOrg } from "@/lib/org";
import { SEASON_PHASES } from "@/constants";
import type { Enums } from "@/types/database";

export async function setSeasonPhase(formData: FormData) {
  const { supabase, org, isStaff } = await requireActiveOrg();
  const phase = String(formData.get("phase") ?? "");
  if (!isStaff || !(SEASON_PHASES as readonly string[]).includes(phase)) return;

  await supabase.rpc("set_current_season_phase", {
    p_org_id: org.id,
    p_phase: phase as Enums<"season_phase">,
  });
  revalidatePath("/", "layout");
}
