"use server";

import { revalidatePath } from "next/cache";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { hasModule } from "@/constants/modules";
import { PAY_METHODS, PAY_TYPES, parseDollars, type PayType } from "@/lib/staff-pay";

type R = { error?: string; ok?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TRY_AGAIN = "That didn't save. Try again.";

function refresh() {
  revalidatePath("/staff", "layout");
}

async function staffCtx() {
  const ctx = await requireActiveOrg();
  if (ctx.preview) return { error: "You're previewing the app." } as const;
  if (!ctx.isStaff) return { error: "Only coaches can log time." } as const;
  if (!hasModule(ctx.org.modules, "staff"))
    return { error: "Turn on Staff time & pay in Settings first." } as const;
  return ctx;
}

async function adminCtx() {
  const ctx = await staffCtx();
  if ("error" in ctx) return ctx;
  if (ctx.membership.role !== "admin")
    return { error: "Only a team admin can approve or pay time." } as const;
  return ctx;
}

/** "1.5", "1:30", "90m", "2h" → minutes. */
function readMinutes(input: unknown) {
  const s = String(input ?? "")
    .trim()
    .toLowerCase();
  if (!s) return null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{1,2}):([0-5]\d)$/))) return Number(m[1]) * 60 + Number(m[2]);
  if ((m = s.match(/^(\d{1,4})\s*m(in)?$/))) return Number(m[1]);
  if ((m = s.match(/^(\d{1,2}(\.\d+)?)\s*h?$/))) return Math.round(Number(m[1]) * 60);
  return null;
}

/** Start the clock now. */
export async function clockIn(): Promise<R> {
  const ctx = await staffCtx();
  if ("error" in ctx) return ctx;
  const { today } = await playerToday();
  const { error } = await ctx.supabase.from("staff_time_entries").insert({
    org_id: ctx.org.id,
    profile_id: ctx.user.id,
    work_date: today,
    kind: "shift",
    started_at: new Date().toISOString(),
    created_by: ctx.user.id,
  });
  if (error?.code === "23505") return { error: "You're already clocked in." };
  if (error) return { error: TRY_AGAIN };
  refresh();
  return {};
}

/** Stop the running clock, with an optional note on what it was for. */
export async function clockOut(activity?: string): Promise<R> {
  const ctx = await staffCtx();
  if ("error" in ctx) return ctx;
  const { data: open } = await ctx.supabase
    .from("staff_time_entries")
    .select("id, started_at")
    .eq("org_id", ctx.org.id)
    .eq("profile_id", ctx.user.id)
    .eq("kind", "shift")
    .not("started_at", "is", null)
    .is("ended_at", null)
    .maybeSingle();
  if (!open?.started_at) return { error: "You're not clocked in." };
  const now = new Date();
  if (now.getTime() - new Date(open.started_at).getTime() > 24 * 3600e3)
    return {
      error: "That clock ran for more than a day. Remove it and add the hours by hand.",
    };
  const { error } = await ctx.supabase
    .from("staff_time_entries")
    .update({
      ended_at: now.toISOString(),
      activity:
        String(activity ?? "")
          .trim()
          .slice(0, 120) || null,
    })
    .eq("id", open.id);
  if (error) return { error: TRY_AGAIN };
  refresh();
  return {};
}

/** Add time by hand (or from "I worked this" on a recent practice or game). */
export async function addTime(_: R, fd: FormData): Promise<R> {
  const ctx = await staffCtx();
  if ("error" in ctx) return ctx;
  const date = String(fd.get("work_date") ?? "");
  const minutes = readMinutes(fd.get("hours"));
  const activity = String(fd.get("activity") ?? "")
    .trim()
    .slice(0, 120);
  const note = String(fd.get("note") ?? "")
    .trim()
    .slice(0, 500);
  const practiceId = String(fd.get("practice_id") ?? "");
  const gameId = String(fd.get("game_id") ?? "");
  const { today } = await playerToday();
  if (!DATE.test(date)) return { error: "Pick the day you worked." };
  if (date > today) return { error: "You can't log time for a day that hasn't happened yet." };
  if (minutes == null || minutes <= 0 || minutes > 1440)
    return { error: "Enter how long you worked, like 1.5 or 1:30." };

  const { data: rate } = await ctx.supabase
    .from("staff_pay_rates")
    .select("pay_type")
    .eq("org_id", ctx.org.id)
    .eq("profile_id", ctx.user.id)
    .maybeSingle();
  const { error } = await ctx.supabase.from("staff_time_entries").insert({
    org_id: ctx.org.id,
    profile_id: ctx.user.id,
    work_date: date,
    kind: rate?.pay_type === "per_session" ? "session" : "shift",
    minutes,
    activity: activity || null,
    note: note || null,
    practice_id: UUID.test(practiceId) ? practiceId : null,
    game_id: UUID.test(gameId) ? gameId : null,
    status: fd.get("submit") === "1" ? "submitted" : "open",
    created_by: ctx.user.id,
  });
  if (error) return { error: TRY_AGAIN };
  refresh();
  return { ok: "Added." };
}

/** Send all of my finished, unsubmitted time for approval. */
export async function submitTime(): Promise<R> {
  const ctx = await staffCtx();
  if ("error" in ctx) return ctx;
  const { data, error } = await ctx.supabase
    .from("staff_time_entries")
    .update({ status: "submitted" })
    .eq("org_id", ctx.org.id)
    .eq("profile_id", ctx.user.id)
    .in("status", ["open", "rejected"])
    .or("started_at.is.null,ended_at.not.is.null")
    .select("id");
  if (error) return { error: TRY_AGAIN };
  refresh();
  return { ok: `Sent ${data.length} for approval.` };
}

/** Take a submitted entry back to fix it. */
export async function unsubmitTime(id: string): Promise<R> {
  const ctx = await staffCtx();
  if ("error" in ctx) return ctx;
  if (!UUID.test(id)) return { error: TRY_AGAIN };
  const { error } = await ctx.supabase
    .from("staff_time_entries")
    .update({ status: "open" })
    .eq("id", id)
    .eq("profile_id", ctx.user.id)
    .eq("status", "submitted");
  if (error) return { error: TRY_AGAIN };
  refresh();
  return {};
}

export async function deleteTime(id: string): Promise<R> {
  const ctx = await staffCtx();
  if ("error" in ctx) return ctx;
  if (!UUID.test(id)) return { error: TRY_AGAIN };
  const { data, error } = await ctx.supabase
    .from("staff_time_entries")
    .delete()
    .eq("id", id)
    .select("id");
  if (error || !data.length) return { error: "That time can't be removed now." };
  refresh();
  return {};
}

/** Admin: how one staff member is paid. */
export async function saveRate(_: R, fd: FormData): Promise<R> {
  const ctx = await adminCtx();
  if ("error" in ctx) return ctx;
  const profileId = String(fd.get("profile_id") ?? "");
  const payType = String(fd.get("pay_type") ?? "") as PayType;
  if (!UUID.test(profileId)) return { error: TRY_AGAIN };
  if (!PAY_TYPES.some((p) => p.key === payType)) return { error: "Choose how they're paid." };
  const rate = parseDollars(fd.get("rate"));
  const stipend = parseDollars(fd.get("stipend"));
  const payments = Math.trunc(Number(fd.get("stipend_payments") || 1));
  if ((payType === "hourly" || payType === "per_session") && !rate)
    return { error: "Enter the pay rate, like 20 or 18.50." };
  if (payType === "stipend" && !stipend) return { error: "Enter the season stipend." };
  if (rate == null || stipend == null) return { error: "Enter amounts in dollars, like 18.50." };
  if (!(payments >= 1 && payments <= 52))
    return { error: "Split the stipend into 1 to 52 payments." };
  const { error } = await ctx.supabase.from("staff_pay_rates").upsert({
    org_id: ctx.org.id,
    profile_id: profileId,
    pay_type: payType,
    rate_cents: payType === "hourly" || payType === "per_session" ? rate : 0,
    stipend_cents: payType === "stipend" ? stipend : 0,
    stipend_payments: payType === "stipend" ? payments : 1,
    title:
      String(fd.get("title") ?? "")
        .trim()
        .slice(0, 80) || null,
    updated_at: new Date().toISOString(),
    updated_by: ctx.user.id,
  });
  if (error) return { error: TRY_AGAIN };
  refresh();
  return { ok: "Saved." };
}

/** Admin: approve or send back time. */
export async function reviewTime(ids: string[], approve: boolean, note?: string): Promise<R> {
  const ctx = await adminCtx();
  if ("error" in ctx) return ctx;
  const clean = ids.filter((i) => UUID.test(i)).slice(0, 500);
  if (!clean.length) return { error: "Nothing selected." };
  const { data, error } = await ctx.supabase.rpc("review_staff_time", {
    p_ids: clean,
    p_approve: approve,
    p_note: String(note ?? "").slice(0, 300),
  });
  if (error) return { error: TRY_AGAIN };
  refresh();
  return { ok: `${approve ? "Approved" : "Sent back"} ${data ?? 0}.` };
}

/** Admin: record pay for a date range and mark that approved time paid. */
export async function payPeriod(input: {
  from: string;
  to: string;
  method: string;
  reference: string;
  payments: { profileId: string; cents: number }[];
}): Promise<R> {
  const ctx = await adminCtx();
  if ("error" in ctx) return ctx;
  const { from, to } = input;
  if (!DATE.test(from) || !DATE.test(to) || to < from) return { error: "Check the dates." };
  if (!PAY_METHODS.some((m) => m.key === input.method)) return { error: "Choose how you paid." };
  const payments = input.payments.filter(
    (p) => UUID.test(p.profileId) && Number.isInteger(p.cents) && p.cents >= 0,
  );
  if (!payments.length) return { error: "No one to pay in these dates." };

  const { data: period, error } = await ctx.supabase
    .from("staff_pay_periods")
    .insert({ org_id: ctx.org.id, starts_on: from, ends_on: to, created_by: ctx.user.id })
    .select("id")
    .single();
  if (error) return { error: "Pay periods can be up to two months long." };
  const { error: payError } = await ctx.supabase.rpc("pay_staff_period", {
    p_period: period.id,
    p_payments: payments.map((p) => ({
      profile_id: p.profileId,
      amount_cents: p.cents,
      method: input.method,
      reference: input.reference.trim().slice(0, 120),
    })),
  });
  if (payError) {
    await ctx.supabase.from("staff_pay_periods").delete().eq("id", period.id);
    return { error: TRY_AGAIN };
  }
  refresh();
  return { ok: "Marked paid." };
}
