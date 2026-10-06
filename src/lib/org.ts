import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STAFF_ROLES } from "@/constants";

export const ACTIVE_ORG_COOKIE = "dp_active_org";

/** The signed-in user, or a redirect to /login. Cached per request. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
});

/** All of the user's org memberships, with the org joined. */
export const getMemberships = cache(async () => {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("org_memberships")
    .select("id, role, status, org:organizations (id, name, slug, plan_tier)")
    .eq("profile_id", user.id)
    .order("created_at");
  if (error) throw error;
  return data;
});

/**
 * The org the user is currently working in (from a cookie, falling back to
 * their first membership). Redirects to onboarding when they have none.
 */
export const requireActiveOrg = cache(async () => {
  const { supabase, user } = await requireUser();
  const memberships = await getMemberships();
  if (memberships.length === 0) redirect("/onboarding");

  const activeId = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const membership = memberships.find((m) => m.org.id === activeId) ?? memberships[0];

  return {
    supabase,
    user,
    memberships,
    membership,
    org: membership.org,
    isStaff: STAFF_ROLES.includes(membership.role),
  };
});
