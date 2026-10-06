"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/auth/actions";
import { ACTIVE_ORG_COOKIE } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

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

  (await cookies()).set(ACTIVE_ORG_COOKIE, org.id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/");
}
