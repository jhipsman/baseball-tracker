"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveOrg, setActiveOrgCookie } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { dispatchPush } from "@/lib/push";
import { readCents } from "@/lib/team-payments";
import type { FormState } from "@/lib/auth/actions";
import type { Json } from "@/types/database";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function admin() {
  const ctx = await requireActiveOrg();
  if (ctx.membership.role !== "admin")
    return { error: "Only team admins can manage registration." } as const;
  return ctx;
}

export async function createRegistrationForm(
  _prev: FormState & { id?: string },
  fd: FormData,
): Promise<FormState & { id?: string }> {
  const ctx = await admin();
  if ("error" in ctx) return { error: ctx.error };
  const title = text(fd, "title"),
    season = text(fd, "season"),
    waiver = text(fd, "waiver");
  const fee = text(fd, "fee") ? readCents(text(fd, "fee")) : 0;
  const installments = Math.round(Number(fd.get("installments") ?? 1));
  const capacity = text(fd, "capacity") ? Math.round(Number(text(fd, "capacity"))) : null;
  const firstDue = text(fd, "first_due");
  if (!title || title.length > 120) return { error: "Give it a name, like “Spring 2027 · 14U”." };
  if (!season || season.length > 80) return { error: "Add the season." };
  if (fee === null || fee < 0 || (fee > 0 && fee < 100))
    return { error: "Enter the fee in dollars (or leave it blank for free)." };
  if (!(installments >= 1 && installments <= 12)) return { error: "Choose how families can pay." };
  if (capacity !== null && !(capacity >= 1 && capacity <= 500))
    return { error: "Spots must be 1–500 (or blank)." };
  if (firstDue && !/^\d{4}-\d{2}-\d{2}$/.test(firstDue))
    return { error: "Check the first due date." };
  if (waiver.length < 20) return { error: "Add the waiver families will sign." };
  const { data, error } = await ctx.supabase
    .from("registration_forms")
    .insert({
      org_id: ctx.org.id,
      title,
      season,
      fee_cents: fee,
      installments_max: fee > 0 ? installments : 1,
      first_due: firstDue || null,
      waiver_text: waiver,
      capacity,
      created_by: ctx.user.id,
    })
    .select("id")
    .single();
  if (error) return { error: "Couldn't create it. Check your signal and try again." };
  revalidatePath("/registration");
  // Straight to the new link so it can be copied and shared.
  redirect(`/registration/${data.id}`);
}

export async function setRegistrationOpen(
  formId: string,
  open: boolean,
): Promise<{ error?: string }> {
  const ctx = await admin();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.supabase
    .from("registration_forms")
    .update({ open })
    .eq("id", formId)
    .eq("org_id", ctx.org.id);
  if (error) return { error: "Couldn't save. Try again." };
  revalidatePath("/registration", "layout");
  return {};
}

export async function withdrawRegistration(regId: string): Promise<{ error?: string }> {
  const ctx = await admin();
  if ("error" in ctx) return { error: ctx.error };
  const { error } = await ctx.supabase
    .from("team_registrations")
    .update({ status: "withdrawn" })
    .eq("id", regId)
    .eq("org_id", ctx.org.id);
  if (error) return { error: "Couldn't save. Try again." };
  revalidatePath("/registration", "layout");
  return {};
}

export async function linkRegistrationPlayer(
  regId: string,
  playerId: string,
): Promise<{ error?: string }> {
  const ctx = await admin();
  if ("error" in ctx) return { error: ctx.error };
  if (!UUID.test(regId) || !UUID.test(playerId)) return { error: "Choose a player." };
  const { error } = await ctx.supabase.rpc("link_registration_player", {
    p_org: ctx.org.id,
    p_reg: regId,
    p_player: playerId,
  });
  if (error) return { error: "Couldn't link them. Make sure the player is on the roster." };
  revalidatePath("/registration", "layout");
  return {};
}

export type RegistrationInput = {
  parent_name: string;
  parent_phone: string;
  player_name: string;
  player_birth_date: string;
  player_email: string;
  player_position: string;
  emergency_name: string;
  emergency_phone: string;
  emergency_relation: string;
  medical_notes: string;
  waiver_signed_name: string;
};

/** A family registers a player (signed in). Joins the team as a parent and creates their payment plan. */
export async function submitRegistration(
  token: string,
  data: RegistrationInput,
  installments: number,
  agreed: boolean,
): Promise<{ error?: string; id?: string }> {
  if (!UUID.test(token)) return { error: "This registration link is not valid." };
  if (!agreed) return { error: "Check the box to agree to the waiver." };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { error: "Sign in to register." };
  after(() => dispatchPush());
  const { data: id, error } = await supabase.rpc("submit_registration", {
    p_token: token,
    p_data: data as unknown as Json,
    p_installments: installments,
  });
  if (error) {
    const known = [
      "Registration is closed.",
      "Registration is full.",
      "Fill in every required field.",
      "Check the player's birthdate.",
      "Enter the player's birthdate.",
      "Check the player's email address.",
      "Confirm your email address first, then try again.",
    ];
    if (error.code === "23505") return { error: "You've already registered this player." };
    if (error.message.startsWith("You are already on this team")) return { error: error.message };
    return {
      error:
        known.find((k) => error.message.includes(k)) ??
        "Registration didn't go through. Try again.",
    };
  }
  // Land in the team they just joined (families may already be on another team).
  const { data: reg } = await supabase
    .from("team_registrations")
    .select("org_id")
    .eq("id", id as string)
    .maybeSingle();
  if (reg) await setActiveOrgCookie(reg.org_id);
  revalidatePath("/payments");
  revalidatePath("/registration", "layout");
  return { id: id as string };
}
