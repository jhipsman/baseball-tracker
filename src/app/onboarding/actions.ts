"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/auth/actions";
import { setActiveOrgCookie } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import { TEAM_TYPES } from "@/constants/modules";

export async function createOrganization(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "") || name);

  if (!name) return { error: "Organization name is required." };
  if (slug.length < 2) return { error: "URL must be at least 2 characters." };

  const supabase = await createClient();
  const { data: org, error } = await supabase.rpc("create_organization", {
    p_name: name,
    p_slug: slug,
  });

  if (error) {
    if (error.code === "23505") return { error: `The URL "${slug}" is already taken.` };
    return { error: error.message };
  }

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
