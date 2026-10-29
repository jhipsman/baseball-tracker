"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_ORG_COOKIE, setActiveOrgCookie } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";

export async function acceptInvitation(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const supabase = await createClient();
  const { data: orgId, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error)
    redirect(`/invite/${encodeURIComponent(token)}?error=${encodeURIComponent(error.message)}`);

  await setActiveOrgCookie(orgId);

  // Parents land straight on their dashboard.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: membership } = user
    ? await supabase
        .from("org_memberships")
        .select("role")
        .eq("org_id", orgId)
        .eq("profile_id", user.id)
        .maybeSingle()
    : { data: null };
  redirect(membership?.role === "parent" ? "/parent" : "/");
}

/**
 * "Wrong account" on an invite: sign out, then come straight back to this
 * invitation (via sign-in / create account) instead of a plain sign-in page.
 */
export async function switchAccountForInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(ACTIVE_ORG_COOKIE);
  redirect(`/login?next=${encodeURIComponent(`/invite/${encodeURIComponent(token)}`)}`);
}
