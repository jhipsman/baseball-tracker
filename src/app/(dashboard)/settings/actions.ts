"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/auth/actions";
import { requireActiveOrg } from "@/lib/org";
import { cleanModules, TEAM_TYPES } from "@/constants/modules";

export async function updateTeamSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, org, membership } = await requireActiveOrg();
  if (membership.role !== "admin") return { error: "Only team admins can change settings." };

  const teamType = String(formData.get("team_type") ?? "");
  const modules = cleanModules(formData.getAll("modules"));
  const { error } = await supabase
    .from("organizations")
    .update({
      modules,
      team_type: TEAM_TYPES.some((t) => t.key === teamType)
        ? (teamType as (typeof TEAM_TYPES)[number]["key"])
        : null,
    })
    .eq("id", org.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { message: "Settings saved." };
}
