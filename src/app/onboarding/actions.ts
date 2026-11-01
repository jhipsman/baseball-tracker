"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/auth/actions";
import { setActiveOrgCookie } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import { TEAM_TYPES } from "@/constants/modules";

export async function createOrganization(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Enter your team's name." };

  // The address is internal: make one from the name, numbered if it's taken.
  const base = slugify(name).slice(0, 40) || "team";
  const slug = base.length < 2 ? `${base}-team` : base;
  const supabase = await createClient();
  let org: { id: string } | null = null;
  for (let attempt = 0; attempt < 6 && !org; attempt++) {
    const suffix =
      attempt === 0 ? "" : attempt < 4 ? `-${attempt + 1}` : `-${crypto.randomUUID().slice(0, 6)}`;
    const { data, error } = await supabase.rpc("create_organization", {
      p_name: name,
      p_slug: `${slug}${suffix}`,
    });
    if (!error) org = data;
    else if (error.code !== "23505") return { error: error.message };
  }
  if (!org) return { error: "Couldn't create the team. Please try again." };

  // Start with the features that fit this kind of team (changeable in Settings).
  const type = TEAM_TYPES.find((t) => t.key === formData.get("team_type"));
  if (type) {
    await supabase
      .from("organizations")
      .update({ team_type: type.key, modules: type.modules })
      .eq("id", org.id);
  }

  await setActiveOrgCookie(org.id);

  redirect("/");
}
