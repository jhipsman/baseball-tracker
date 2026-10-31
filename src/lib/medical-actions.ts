"use server";

import { revalidatePath } from "next/cache";
import { requireActiveOrg } from "@/lib/org";
import { parseContacts, type Contact } from "@/lib/medical";
import type { Json } from "@/types/database";

type R = { error?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v: unknown, max: number) =>
  String(v ?? "")
    .trim()
    .slice(0, max) || null;

/** The family (or a coach) updates a player's game-day medical card. */
export async function saveMedicalCard(
  playerId: string,
  input: { allergies: string; medications: string; conditions: string; contacts: Contact[] },
): Promise<R> {
  const { supabase, org, user } = await requireActiveOrg();
  if (!UUID.test(playerId)) return { error: "Player not found." };
  const contacts = parseContacts(input.contacts);
  if (!contacts.some((c) => c.phone)) return { error: "Add at least one emergency phone number." };
  const { error } = await supabase.from("player_medical").upsert({
    org_id: org.id,
    player_id: playerId,
    allergies: text(input.allergies, 300),
    medications: text(input.medications, 300),
    conditions: text(input.conditions, 500),
    contacts: contacts as unknown as Json,
    updated_by: user.id,
  });
  if (error) return { error: "Couldn't save. Check your signal and try again." };
  revalidatePath("/throwing/medical");
  revalidatePath("/player/medical");
  revalidatePath("/parent/medical");
  return {};
}

/** Admins: the team's field emergency plan (hospital, AED, who calls 911). */
export async function saveEmergencyPlan(plan: string): Promise<R> {
  const { supabase, org, membership } = await requireActiveOrg();
  if (membership.role !== "admin") return { error: "Only team admins can change this." };
  const { error } = await supabase
    .from("organizations")
    .update({ emergency_plan: text(plan, 1000) })
    .eq("id", org.id);
  if (error) return { error: "Couldn't save. Try again." };
  revalidatePath("/throwing/medical");
  return {};
}
