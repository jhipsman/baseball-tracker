"use server";

import { revalidatePath } from "next/cache";
import { requireActiveOrg } from "@/lib/org";
import {
  BODY_PART,
  isBodyPart,
  isInjuryType,
  parsePlan,
  type HealthState,
  type InjuryType,
  type PlanStep,
  type Side,
} from "@/lib/health";
import type { Json } from "@/types/database";

type R = { error?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES: HealthState[] = ["full", "limited", "out"];

async function staff() {
  const ctx = await requireActiveOrg();
  if (!ctx.isStaff) return { error: "Only coaches can change Player Health." } as const;
  return ctx;
}

function refresh(playerId: string) {
  revalidatePath("/throwing", "layout");
  revalidatePath(`/roster/${playerId}`);
  revalidatePath("/player", "layout");
  revalidatePath("/parent", "layout");
}

/** The coach's call: full, limited or out, with a reason, return date and return-to-throw plan. */
export async function setHealthStatus(
  playerId: string,
  input: {
    status: HealthState;
    reason?: string;
    returnDate?: string | null;
    plan?: PlanStep[];
    injuryType?: InjuryType | null;
    bodyPart?: string | null;
    side?: Side | null;
    startedOn?: string | null;
  },
): Promise<R> {
  const ctx = await staff();
  if ("error" in ctx) return { error: ctx.error };
  if (!UUID.test(playerId)) return { error: "Player not found." };
  if (!STATES.includes(input.status)) return { error: "Choose full, limited or out." };
  const day = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const returnDate = day(input.returnDate);
  const full = input.status === "full";
  const injuryType = !full && isInjuryType(input.injuryType) ? input.injuryType : null;
  const bodyPart =
    !full && injuryType !== "illness" && isBodyPart(input.bodyPart) ? input.bodyPart : null;
  const side =
    bodyPart && BODY_PART[bodyPart].sided && ["left", "right", "both"].includes(input.side ?? "")
      ? input.side!
      : null;
  if (injuryType === "concussion" && input.status !== "out") {
    const { data: was } = await ctx.supabase
      .from("player_health_status")
      .select("injury_type, status")
      .eq("org_id", ctx.org.id)
      .eq("player_id", playerId)
      .maybeSingle();
    // A new concussion always starts Out; later steps can move to Limited.
    if (!(was?.injury_type === "concussion" && was.status !== "full"))
      return { error: "A suspected concussion starts as Out: no practice or games." };
  }
  const { error } = await ctx.supabase.from("player_health_status").upsert({
    org_id: ctx.org.id,
    player_id: playerId,
    status: input.status,
    reason: full
      ? null
      : String(input.reason ?? "")
          .trim()
          .slice(0, 200) || null,
    return_date: full ? null : returnDate,
    plan: (full ? [] : parsePlan(input.plan)) as unknown as Json,
    injury_type: injuryType,
    body_part: bodyPart,
    side,
    started_on: full ? null : (day(input.startedOn) ?? null),
    ...(full ? { clearance_path: null, clearance_by: null, clearance_at: null } : {}),
    updated_by: ctx.user.id,
  });
  if (error)
    return {
      error:
        error.code === "42501"
          ? "A concussion needs a doctor's written clearance on file first. Upload it below."
          : "Couldn't save. Check your signal and try again.",
    };
  refresh(playerId);
  return {};
}

/** Tick a return-to-throw step on or off. */
export async function togglePlanStep(playerId: string, index: number): Promise<R> {
  const ctx = await staff();
  if ("error" in ctx) return { error: ctx.error };
  const { data } = await ctx.supabase
    .from("player_health_status")
    .select("plan")
    .eq("org_id", ctx.org.id)
    .eq("player_id", playerId)
    .maybeSingle();
  const plan = parsePlan(data?.plan);
  if (!plan[index]) return { error: "That step is gone. Refresh and try again." };
  plan[index] = { ...plan[index], done: !plan[index].done };
  const { error } = await ctx.supabase
    .from("player_health_status")
    .update({ plan: plan as unknown as Json, updated_by: ctx.user.id })
    .eq("org_id", ctx.org.id)
    .eq("player_id", playerId);
  if (error) return { error: "Couldn't save. Check your signal and try again." };
  refresh(playerId);
  return {};
}

/** Mark an alert handled (it leaves the Today board; the player page keeps it). */
export async function markAlertHandled(playerId: string, key: string, note?: string): Promise<R> {
  const ctx = await staff();
  if ("error" in ctx) return { error: ctx.error };
  if (!UUID.test(playerId) || !/^[a-z]+(:[\d-]*)?$/.test(key) || key.length > 64)
    return { error: "Alert not found." };
  const { error } = await ctx.supabase.from("health_alert_acks").upsert(
    {
      org_id: ctx.org.id,
      player_id: playerId,
      alert_key: key,
      note:
        String(note ?? "")
          .trim()
          .slice(0, 200) || null,
      acked_by: ctx.user.id,
    },
    { onConflict: "org_id,player_id,alert_key", ignoreDuplicates: true },
  );
  if (error) return { error: "Couldn't save. Check your signal and try again." };
  refresh(playerId);
  return {};
}

/** Put a handled alert back on the board. */
export async function reopenAlert(playerId: string, key: string): Promise<R> {
  const ctx = await staff();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.supabase
    .from("health_alert_acks")
    .delete()
    .eq("org_id", ctx.org.id)
    .eq("player_id", playerId)
    .eq("alert_key", key);
  if (error) return { error: "Couldn't save. Check your signal and try again." };
  refresh(playerId);
  return {};
}

/**
 * Attach a doctor's note / written clearance (already uploaded to
 * {org}/health/{player}/…) to the player's open injury. Coaches, the player or
 * a parent; coaches are told when a family uploads one.
 */
export async function attachClearance(playerId: string, path: string): Promise<R> {
  const { supabase, org } = await requireActiveOrg();
  if (!UUID.test(playerId) || !path.startsWith(`${org.id}/health/${playerId}/`))
    return { error: "Upload didn't match. Try again." };
  const { error } = await supabase.rpc("submit_health_clearance", {
    p_org: org.id,
    p_player: playerId,
    p_path: path,
  });
  if (error) {
    await supabase.storage.from("team-docs").remove([path]);
    return {
      error: error.message.includes("no open injury")
        ? "There's no open injury to attach this to."
        : "Couldn't save the note. Try again.",
    };
  }
  refresh(playerId);
  return {};
}

/** A short-lived link to a health file (doctor's note) the person may see. */
export async function openHealthFile(path: string): Promise<{ url?: string; error?: string }> {
  const { supabase, org } = await requireActiveOrg();
  if (typeof path !== "string" || !path.startsWith(`${org.id}/health/`) || path.length > 300)
    return { error: "File not found." };
  const { data } = await supabase.storage.from("team-docs").createSignedUrl(path, 300);
  return data ? { url: data.signedUrl } : { error: "You can't open that file." };
}
