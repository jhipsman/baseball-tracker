"use server";

import { redirect } from "next/navigation";
import { createDemoTeam, deleteDemoTeam } from "@/lib/demo";
import { getMemberships, requireUser, setActiveOrgCookie } from "@/lib/org";
import { playerToday } from "@/lib/player";

/** Create (or open) your demo team and switch to it. */
export async function openDemoTeam() {
  const { supabase, user } = await requireUser();
  const { today } = await playerToday();
  const orgId = await createDemoTeam(supabase, user.id, today);
  await setActiveOrgCookie(orgId);
  redirect("/");
}

/** Delete your demo team and its sample people, then go back to a real team. */
export async function removeDemoTeam(formData: FormData) {
  const { supabase } = await requireUser();
  await deleteDemoTeam(supabase, String(formData.get("org_id") ?? ""));
  const next = (await getMemberships()).find((m) => !m.org.is_demo);
  if (next) {
    await setActiveOrgCookie(next.org.id);
    redirect("/");
  }
  redirect("/onboarding");
}
