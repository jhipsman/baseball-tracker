"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/auth/actions";
import { requireActiveOrg, requireUser } from "@/lib/org";

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireUser();
  const fullName = String(formData.get("full_name") ?? "")
    .trim()
    .slice(0, 120);
  if (!fullName) return { error: "Name is required." };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id);
  if (error) return { error: error.message };
  await supabase.auth.updateUser({ data: { full_name: fullName } });
  revalidatePath("/player", "layout");
  return { message: "Saved." };
}

/** A player invites their own parent or guardian (role parent, linked to themselves). */
export async function inviteMyParent(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user, org, membership } = await requireActiveOrg();
  if (membership.role !== "player") return { error: "Only players can invite their parents here." };

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const values = { email };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email.", values };
  if (email === user.email?.toLowerCase()) {
    return { error: "Enter your parent's email, not your own.", values };
  }

  const { error } = await supabase.from("org_invitations").insert({
    org_id: org.id,
    email,
    role: "parent",
    invited_by: user.id,
    player_id: user.id,
  });
  if (error) {
    if (error.code === "23505") {
      return { error: `${email} already has a pending invitation to this team.`, values };
    }
    return { error: error.message, values };
  }

  revalidatePath("/player/profile");
  revalidatePath("/roster", "layout");
  return { message: `Invite created. Copy the link below and send it to ${email}.` };
}

/** Revoke a parent invitation for yourself (RLS: only ones you sent). */
export async function revokeMyParentInvite(formData: FormData) {
  const { supabase, user, org } = await requireActiveOrg();
  await supabase
    .from("org_invitations")
    .delete()
    .eq("id", String(formData.get("id") ?? ""))
    .eq("org_id", org.id)
    .eq("role", "parent")
    .eq("player_id", user.id);
  revalidatePath("/player/profile");
  revalidatePath("/roster", "layout");
}
