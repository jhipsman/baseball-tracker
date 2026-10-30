import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STAFF_ROLES } from "@/constants";
import { VIEW_AS_COOKIE } from "@/lib/view-as";

export const ACTIVE_ORG_COOKIE = "dp_active_org";

/** Remember which org the user is working in. Server actions / route handlers only. */
export async function setActiveOrgCookie(orgId: string) {
  // Secure only over HTTPS, so `next start` over plain http on a LAN still works.
  const https = (await headers()).get("x-forwarded-proto") === "https";
  (await cookies()).set(ACTIVE_ORG_COOKIE, orgId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: https,
    maxAge: 60 * 60 * 24 * 365,
  });
}

/**
 * The signed-in user, or a redirect to /login. Cached per request.
 * getClaims() verifies the session token's signature locally (no round trip
 * to the auth server on every page), falling back to the server when needed.
 */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  const user = {
    id: claims.sub,
    email: claims.email,
    user_metadata: (claims.user_metadata ?? {}) as Record<string, unknown>,
  };
  return { supabase, user };
});

/** All of the user's org memberships, with the org joined. */
export const getMemberships = cache(async () => {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("org_memberships")
    .select(
      "id, role, status, org:organizations (id, name, slug, plan_tier, current_season_phase, modules, team_type, is_demo)",
    )
    .eq("profile_id", user.id)
    .order("created_at");
  if (error) throw error;
  return data;
});

/**
 * The org the user is currently working in (from a cookie, falling back to
 * their first membership), as the signed-in user. Redirects to onboarding
 * when they have none. Ignores "View as".
 */
export const requireRealActiveOrg = cache(async () => {
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
    preview: null as Preview | null,
  };
});

export type Preview = { name: string; role: "player" | "parent"; realUserId: string };

/**
 * Like requireRealActiveOrg, but while a team admin is previewing the app
 * ("View as", a read-only mode) it answers as that player or parent instead.
 * Data is still read with the admin's own permissions; the proxy blocks every
 * change while previewing.
 */
export const requireActiveOrg = cache(async () => {
  const real = await requireRealActiveOrg();
  const targetId = (await cookies()).get(VIEW_AS_COOKIE)?.value;
  if (!targetId || real.membership.role !== "admin" || targetId === real.user.id) return real;

  const { data: target } = await real.supabase
    .from("org_memberships")
    .select("id, role, status, profile:profiles (id, full_name, email)")
    .eq("org_id", real.org.id)
    .eq("profile_id", targetId)
    .in("role", ["player", "parent"])
    .maybeSingle();
  if (!target?.profile) return real;

  const name = target.profile.full_name || "Team member";
  const membership = { id: target.id, role: target.role, status: target.status, org: real.org };
  return {
    ...real,
    user: {
      id: target.profile.id,
      email: target.profile.email,
      user_metadata: { full_name: name },
    },
    memberships: [membership],
    membership,
    isStaff: false,
    preview: {
      name,
      role: target.role as Preview["role"],
      realUserId: real.user.id,
    } satisfies Preview,
  };
});
