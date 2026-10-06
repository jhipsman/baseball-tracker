"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/auth/actions";
import { requireActiveOrg } from "@/lib/org";
import { ORG_ROLES, PLAYER_POSITIONS, type OrgRole } from "@/constants";
import type { Enums } from "@/types/database";

function isRole(v: unknown): v is OrgRole {
  return typeof v === "string" && (ORG_ROLES as readonly string[]).includes(v);
}

export async function inviteMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user, org, membership } = await requireActiveOrg();
  if (membership.role !== "admin") return { error: "Only admins can invite members." };

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const role = formData.get("role");
  const values = { email, role: String(role ?? "") };

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email.", values };
  if (!isRole(role)) return { error: "Choose a role.", values };

  const { error } = await supabase
    .from("org_invitations")
    .insert({ org_id: org.id, email, role, invited_by: user.id });

  if (error) {
    if (error.code === "23505") {
      return { error: `${email} already has a pending invitation.`, values };
    }
    return { error: error.message, values };
  }

  revalidatePath("/roster");
  return { message: `Invitation created for ${email}. Copy the link below and send it to them.` };
}

export async function revokeInvitation(formData: FormData) {
  const { supabase } = await requireActiveOrg();
  await supabase
    .from("org_invitations")
    .delete()
    .eq("id", String(formData.get("id")));
  revalidatePath("/roster");
}

export async function updateMember(formData: FormData) {
  const { supabase, org } = await requireActiveOrg();
  const role = formData.get("role");
  if (!isRole(role)) return;

  const position = String(formData.get("position") ?? "");
  const jersey = String(formData.get("jersey_number") ?? "").trim();
  const isPlayer = role === "player";

  await supabase
    .from("org_memberships")
    .update({
      role,
      // Position and jersey only apply to players (enforced by a check constraint).
      position:
        isPlayer && (PLAYER_POSITIONS as readonly string[]).includes(position)
          ? (position as Enums<"player_position">)
          : null,
      jersey_number: isPlayer && /^\d{1,2}$/.test(jersey) ? Number(jersey) : null,
    })
    .eq("id", String(formData.get("id")))
    .eq("org_id", org.id);
  revalidatePath("/roster");
}

export async function removeMember(formData: FormData) {
  const { supabase, org } = await requireActiveOrg();
  await supabase
    .from("org_memberships")
    .delete()
    .eq("id", String(formData.get("id")))
    .eq("org_id", org.id);
  revalidatePath("/roster");
}
