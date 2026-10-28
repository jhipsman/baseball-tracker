"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/auth/actions";
import { requireActiveOrg } from "@/lib/org";
import { INVITABLE_ROLES, ORG_ROLES, PLAYER_POSITIONS, type OrgRole } from "@/constants";
import type { Enums } from "@/types/database";

function isRole(v: unknown): v is OrgRole {
  return typeof v === "string" && (ORG_ROLES as readonly string[]).includes(v);
}

export async function inviteMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user, org, membership, isStaff } = await requireActiveOrg();
  if (!isStaff) return { error: "Only coaches, trainers, and admins can invite people." };

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const role = formData.get("role");
  const playerId = String(formData.get("player_id") ?? "");
  const values = { email, role: String(role ?? ""), player_id: playerId };

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email.", values };
  if (!isRole(role) || !INVITABLE_ROLES.includes(role)) return { error: "Choose a role.", values };
  if (role !== "parent" && membership.role !== "admin") {
    return { error: "Only admins can invite players and staff.", values };
  }

  let playerName = "";
  if (role === "parent") {
    if (!playerId) return { error: "Choose which player they're the parent of.", values };
    const { data: player } = await supabase
      .from("org_memberships")
      .select("profile_id, profile:profiles (full_name, email)")
      .eq("org_id", org.id)
      .eq("profile_id", playerId)
      .eq("role", "player")
      .maybeSingle();
    if (!player) return { error: "Choose a player on this team.", values };
    playerName = player.profile.full_name || player.profile.email;
    // Already a member in another role? Accepting would fail, so say so now.
    const { data: existing } = await supabase
      .from("org_memberships")
      .select("role, profile:profiles!inner (email)")
      .eq("org_id", org.id)
      .eq("profile.email", email)
      .maybeSingle();
    if (existing && existing.role !== "parent") {
      return { error: `${email} is already on this team as a ${existing.role}.`, values };
    }
  }

  const { error } = await supabase.from("org_invitations").insert({
    org_id: org.id,
    email,
    role,
    invited_by: user.id,
    player_id: role === "parent" ? playerId : null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `${email} already has a pending invitation.`, values };
    }
    return { error: error.message, values };
  }

  revalidatePath("/roster", "layout");
  revalidatePath("/player/profile");
  return {
    message: `Invitation created for ${email}${playerName ? ` (parent of ${playerName})` : ""}. Copy the link below and send it to them.`,
  };
}

/** Unlink a parent from a player (staff). The parent stays a member until removed. */
export async function unlinkParent(formData: FormData) {
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) return;
  await supabase
    .from("parent_links")
    .delete()
    .eq("id", String(formData.get("id") ?? ""))
    .eq("org_id", org.id);
  revalidatePath("/roster", "layout");
  revalidatePath("/player/profile");
}

export async function revokeInvitation(formData: FormData) {
  const { supabase } = await requireActiveOrg();
  await supabase
    .from("org_invitations")
    .delete()
    .eq("id", String(formData.get("id")));
  revalidatePath("/roster", "layout");
  revalidatePath("/player/profile");
}

export async function updateMember(formData: FormData) {
  const { supabase, org } = await requireActiveOrg();
  const role = formData.get("role");
  // Parents are linked to players through invitations, so no one is switched to or from parent.
  if (!isRole(role) || role === "parent") return;

  const position = String(formData.get("position") ?? "");
  const status = String(formData.get("status") ?? "");
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
      ...(status === "active" || status === "injured" || status === "inactive" ? { status } : {}),
    })
    .eq("id", String(formData.get("id")))
    .eq("org_id", org.id)
    .neq("role", "parent");
  revalidatePath("/roster", "layout");
}

export async function removeMember(formData: FormData) {
  const { supabase, org } = await requireActiveOrg();
  await supabase
    .from("org_memberships")
    .delete()
    .eq("id", String(formData.get("id")))
    .eq("org_id", org.id);
  revalidatePath("/roster", "layout");
}

export async function createGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user, org, isStaff } = await requireActiveOrg();
  if (!isStaff) return { error: "Only coaches, trainers, and admins can manage groups." };
  const name = String(formData.get("name") ?? "")
    .trim()
    .slice(0, 60);
  if (!name) return { error: "Group name is required." };

  const { error } = await supabase
    .from("player_groups")
    .insert({ org_id: org.id, name, created_by: user.id });
  if (error) {
    if (error.code === "23505") return { error: `There's already a group called "${name}".` };
    return { error: error.message };
  }
  revalidatePath("/roster", "layout");
  return { message: `Created "${name}". Add players to it below.` };
}

export async function deleteGroup(formData: FormData) {
  const { supabase, org } = await requireActiveOrg();
  await supabase
    .from("player_groups")
    .delete()
    .eq("id", String(formData.get("id")))
    .eq("org_id", org.id);
  revalidatePath("/roster", "layout");
}

/** Replace a group's members with the checked players. */
export async function setGroupMembers(formData: FormData) {
  const { supabase, org } = await requireActiveOrg();
  const groupId = String(formData.get("group_id") ?? "");
  const playerIds = [...new Set(formData.getAll("player_id").map(String))];

  const { data: group } = await supabase
    .from("player_groups")
    .select("id")
    .eq("id", groupId)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!group) return;

  await supabase.from("player_group_members").delete().eq("group_id", groupId);
  if (playerIds.length > 0) {
    await supabase
      .from("player_group_members")
      .insert(playerIds.map((profile_id) => ({ group_id: groupId, profile_id })));
  }
  revalidatePath("/roster", "layout");
}
