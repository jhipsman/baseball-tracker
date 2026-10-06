"use server";

import { revalidatePath } from "next/cache";
import { requireActiveOrg } from "@/lib/org";
import { INTENSITIES, PITCH_TYPES, THROW_TYPES } from "@/constants/throwing";
import type { Enums } from "@/types/database";

export type ThrowingInput = {
  playerId?: string;
  date: string;
  type: Enums<"throwing_type">;
  pitches: number;
  maxDistance: number | null;
  intensity: Enums<"throwing_intensity"> | null;
  armFeel: Enums<"arm_feel"> | null;
  pitchesByType: Record<string, number> | null;
  notes: string;
};

const ARM = new Set(["great", "good", "okay", "tired", "sore", "pain"]);

export async function logThrowing(input: ThrowingInput): Promise<{ error?: string; ok?: true }> {
  const { supabase, user, org, isStaff } = await requireActiveOrg();
  const playerId = input.playerId && isStaff ? input.playerId : user.id;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: "Choose a date." };
  if (!THROW_TYPES.some((t) => t.key === input.type)) return { error: "Choose a session type." };
  const checkIn = input.type === "check_in";
  const pitches = checkIn ? 0 : Math.round(Number(input.pitches));
  if (!checkIn && (!Number.isFinite(pitches) || pitches < 1 || pitches > 400)) {
    return { error: "Enter how many throws or pitches (1–400)." };
  }
  if (checkIn && !input.armFeel) return { error: "Pick how your arm feels." };
  if (input.armFeel && !ARM.has(input.armFeel)) return { error: "Invalid arm feel." };
  if (input.intensity && !INTENSITIES.some((i) => i.key === input.intensity)) {
    return { error: "Invalid intensity." };
  }
  const dist = input.maxDistance == null ? null : Math.round(Number(input.maxDistance));
  if (dist != null && (!Number.isFinite(dist) || dist < 0 || dist > 500)) {
    return { error: "Max distance must be 0–500 ft." };
  }
  let mix: Record<string, number> | null = null;
  if (input.pitchesByType && !checkIn) {
    mix = {};
    for (const p of PITCH_TYPES) {
      const v = Math.round(Number(input.pitchesByType[p.key] ?? 0));
      if (Number.isFinite(v) && v > 0 && v <= 400) mix[p.key] = v;
    }
    if (Object.keys(mix).length === 0) mix = null;
  }

  const { error } = await supabase.from("throwing_logs").insert({
    org_id: org.id,
    player_id: playerId,
    logged_by: user.id,
    date: input.date,
    throwing_type: input.type,
    pitch_count: pitches,
    max_distance_ft: input.type === "long_toss" ? dist : null,
    intensity: checkIn ? null : input.intensity,
    pitches_by_type: mix,
    arm_feel: input.armFeel,
    notes:
      String(input.notes ?? "")
        .trim()
        .slice(0, 2000) || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/player/throwing");
  revalidatePath("/throwing");
  revalidatePath("/roster", "layout");
  return { ok: true };
}

export async function deleteThrowing(formData: FormData) {
  const { supabase, org } = await requireActiveOrg();
  await supabase
    .from("throwing_logs")
    .delete()
    .eq("id", String(formData.get("id") ?? ""))
    .eq("org_id", org.id);
  revalidatePath("/player/throwing");
  revalidatePath("/throwing");
  revalidatePath("/roster", "layout");
}

/** Player sets own birthdate, or staff set a player's (playerId). */
export async function setBirthDate(formData: FormData) {
  const { supabase, user, org, isStaff } = await requireActiveOrg();
  const date = String(formData.get("birth_date") ?? "");
  const playerId = String(formData.get("player_id") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  if (playerId && playerId !== user.id) {
    if (!isStaff) return;
    await supabase.rpc("set_player_birth_date", {
      p_org_id: org.id,
      p_player_id: playerId,
      p_birth_date: date,
    });
  } else {
    await supabase.from("profiles").update({ birth_date: date }).eq("id", user.id);
  }
  revalidatePath("/player", "layout");
  revalidatePath("/throwing");
  revalidatePath("/roster", "layout");
}
