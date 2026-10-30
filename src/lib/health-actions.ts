"use server";

import { revalidatePath } from "next/cache";
import { requireActiveOrg } from "@/lib/org";
import { parsePlan, type HealthState, type PlanStep } from "@/lib/health";
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
  input: { status: HealthState; reason?: string; returnDate?: string | null; plan?: PlanStep[] },
): Promise<R> {
  const ctx = await staff();
  if ("error" in ctx) return { error: ctx.error };
  if (!UUID.test(playerId)) return { error: "Player not found." };
  if (!STATES.includes(input.status)) return { error: "Choose full, limited or out." };
  const returnDate =
    input.returnDate && /^\d{4}-\d{2}-\d{2}$/.test(input.returnDate) ? input.returnDate : null;
  const full = input.status === "full";
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
    updated_by: ctx.user.id,
  });
  if (error) return { error: "Couldn't save. Check your signal and try again." };
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
