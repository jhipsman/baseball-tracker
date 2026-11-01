"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveOrg, setActiveOrgCookie } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { dispatchPush } from "@/lib/push";
import { emailEnabled } from "@/lib/email";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Players with no email: add them by name (they're full roster members). */
export async function addRosterPlayers(
  people: { name: string; jersey?: string; position?: string }[],
): Promise<{ error?: string; added?: number }> {
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) return { error: "Only coaches can add players." };
  const clean = (people ?? [])
    .map((p) => ({
      name: String(p?.name ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 80),
      jersey: /^\d{1,2}$/.test(String(p?.jersey ?? "").trim())
        ? String(p.jersey).trim()
        : undefined,
      position: String(p?.position ?? "").slice(0, 10) || undefined,
    }))
    .filter((p) => p.name);
  if (!clean.length) return { error: "Type at least one name." };
  if (clean.length > 300) return { error: "Add up to 300 players at a time." };
  const { data, error } = await supabase.rpc("add_roster_players", {
    p_org: org.id,
    p_people: clean,
  });
  if (error)
    return {
      error: error.message.includes("Only coaches")
        ? error.message
        : "Couldn't add players. Try again.",
    };
  revalidatePath("/roster", "layout");
  return { added: (data as { created: boolean }[]).filter((x) => x.created).length };
}

/**
 * "Give them a login": email a roster-only player a link to set a password on
 * the account they already have (stats, history and parents stay attached).
 */
export async function giveLogin(
  playerId: string,
  email: string,
): Promise<{ error?: string; link?: string; emailed?: boolean }> {
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) return { error: "Only coaches can do this." };
  if (!UUID.test(playerId)) return { error: "Player not found." };
  const { data: token, error } = await supabase.rpc("create_claim_invite", {
    p_org: org.id,
    p_player: playerId,
    p_email: email,
  });
  if (error) return { error: error.message.replace(/^.*?: /, "") };
  after(() => dispatchPush());
  revalidatePath("/roster", "layout");
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  return { link: `${site}/claim/${token}`, emailed: emailEnabled() };
}

/** The claim page: set a password on the placeholder account, sign in, go to the player app. */
export async function claimAccount(_prev: { error?: string } | undefined, formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!UUID.test(token)) return { error: "This link doesn't work. Ask your coach for a new one." };
  if (password.length < 8) return { error: "Use at least 8 characters." };
  const admin = adminClient();
  if (!admin) return { error: "Account setup isn't available yet. Ask your coach." };
  const { data: inv } = await admin
    .from("org_invitations")
    .select("id, org_id, email, claim_profile_id, accepted_at, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!inv?.claim_profile_id)
    return { error: "This link doesn't work. Ask your coach for a new one." };
  if (inv.accepted_at) return { error: "This account is already set up. Sign in instead." };
  if (new Date(inv.expires_at) < new Date())
    return { error: "This link has expired. Ask your coach to send a new one." };
  const { data: user } = await admin.auth.admin.getUserById(inv.claim_profile_id);
  if (!user.user || user.user.app_metadata?.roster_only !== true)
    return { error: "This account is already set up. Sign in instead." };
  const { error: upError } = await admin.auth.admin.updateUserById(inv.claim_profile_id, {
    email: inv.email,
    password,
    email_confirm: true,
    app_metadata: { ...user.user.app_metadata, roster_only: false },
  });
  if (upError)
    return {
      error: /already|registered|exists/i.test(upError.message)
        ? "That email already has a 9D account. Ask your coach to use a different one."
        : "Couldn't set up the account. Try again.",
    };
  await admin.from("profiles").update({ email: inv.email }).eq("id", inv.claim_profile_id);
  await admin
    .from("org_invitations")
    .update({ accepted_at: new Date().toISOString(), accepted_by: inv.claim_profile_id })
    .eq("id", inv.id);
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: inv.email,
    password,
  });
  if (signInError) redirect("/login");
  await setActiveOrgCookie(inv.org_id);
  redirect("/player");
}
