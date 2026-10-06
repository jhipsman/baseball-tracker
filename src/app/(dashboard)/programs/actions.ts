"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/auth/actions";
import { requireActiveOrg } from "@/lib/org";
import { PROGRAM_TYPES, SEASON_PHASES } from "@/constants";
import type { Enums } from "@/types/database";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readProgramFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const programType = String(formData.get("program_type") ?? "");
  const seasonPhase = String(formData.get("season_phase") ?? "");
  return {
    name,
    description: description || null,
    program_type: (PROGRAM_TYPES as readonly string[]).includes(programType)
      ? (programType as Enums<"program_type">)
      : "strength",
    season_phase: (SEASON_PHASES as readonly string[]).includes(seasonPhase)
      ? (seasonPhase as Enums<"season_phase">)
      : null,
    is_template: formData.get("is_template") === "on",
  };
}

function clampInt(value: FormDataEntryValue | null, min: number, max: number, fallback: number) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export async function createProgram(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user, org, isStaff } = await requireActiveOrg();
  if (!isStaff) return { error: "Only coaches, trainers, and admins can create programs." };

  const fields = readProgramFields(formData);
  const values = Object.fromEntries(
    [...formData.entries()].map(([k, v]) => [k, String(v)]),
  ) as Record<string, string>;
  if (!fields.name) return { error: "Program name is required.", values };

  const templateId = String(formData.get("template_id") ?? "");
  let programId: string;

  if (templateId && UUID.test(templateId)) {
    const { data, error } = await supabase.rpc("duplicate_program", {
      p_program_id: templateId,
      p_name: fields.name,
      p_is_template: fields.is_template,
    });
    if (error) return { error: error.message, values };
    programId = data;
    await supabase
      .from("programs")
      .update({ description: fields.description, season_phase: fields.season_phase })
      .eq("id", programId);
  } else {
    const weeks = clampInt(formData.get("weeks"), 1, 52, 4);
    const daysPerWeek = clampInt(formData.get("days_per_week"), 1, 7, 3);

    const { data: program, error } = await supabase
      .from("programs")
      .insert({ ...fields, org_id: org.id, created_by: user.id, duration_weeks: weeks })
      .select("id")
      .single();
    if (error) return { error: error.message, values };
    programId = program.id;

    const structure = Array.from({ length: weeks }, (_, w) => ({
      id: crypto.randomUUID(),
      week_number: w + 1,
      days: Array.from({ length: daysPerWeek }, (_, d) => ({
        id: crypto.randomUUID(),
        day_number: d + 1,
        name: `Day ${d + 1}`,
        session_type: fields.program_type === "throwing" ? "throwing" : "strength",
        sort_order: d,
        exercises: [],
      })),
    }));
    const { error: structureError } = await supabase.rpc("save_program_structure", {
      p_program_id: programId,
      p_weeks: structure,
    });
    if (structureError) return { error: structureError.message, values };
  }

  revalidatePath("/programs");
  redirect(`/programs/${programId}/builder`);
}

export async function updateProgram(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, isStaff } = await requireActiveOrg();
  if (!isStaff) return { error: "Not allowed." };
  const id = String(formData.get("id") ?? "");
  const fields = readProgramFields(formData);
  if (!fields.name) return { error: "Program name is required." };

  const { error } = await supabase.from("programs").update(fields).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/programs/${id}`);
  return { message: "Saved." };
}

export async function duplicateProgram(formData: FormData) {
  const { supabase, isStaff } = await requireActiveOrg();
  if (!isStaff) return;
  const id = String(formData.get("id") ?? "");
  const asTemplate = formData.get("as_template") === "true";
  const name = String(formData.get("name") ?? "");

  const { data, error } = await supabase.rpc("duplicate_program", {
    p_program_id: id,
    p_name: name,
    p_is_template: asTemplate,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/programs");
  redirect(`/programs/${data}`);
}

export async function deleteProgram(formData: FormData) {
  const { supabase, isStaff } = await requireActiveOrg();
  if (!isStaff) return;
  const { error } = await supabase
    .from("programs")
    .delete()
    .eq("id", String(formData.get("id") ?? ""));
  if (error) throw new Error(error.message);
  revalidatePath("/programs");
  redirect("/programs");
}

export async function assignProgram(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user, isStaff } = await requireActiveOrg();
  if (!isStaff) return { error: "Not allowed." };

  const programId = String(formData.get("program_id") ?? "");
  const startDate = String(formData.get("start_date") ?? "");
  const playerIds = formData
    .getAll("player_id")
    .map(String)
    .filter((id) => UUID.test(id));

  if (playerIds.length === 0) return { error: "Select at least one player." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return { error: "Choose a start date." };

  // Skip players who already have this program active.
  const { data: existing } = await supabase
    .from("program_assignments")
    .select("player_id")
    .eq("program_id", programId)
    .eq("status", "active")
    .in("player_id", playerIds);
  const already = new Set((existing ?? []).map((a) => a.player_id));
  const rows = playerIds
    .filter((id) => !already.has(id))
    .map((player_id) => ({
      program_id: programId,
      player_id,
      assigned_by: user.id,
      start_date: startDate,
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from("program_assignments").insert(rows);
    if (error) return { error: error.message };
  }

  revalidatePath(`/programs/${programId}`);
  const skipped = playerIds.length - rows.length;
  return {
    message:
      `Assigned to ${rows.length} player${rows.length === 1 ? "" : "s"}.` +
      (skipped ? ` ${skipped} already had it active.` : ""),
  };
}

export async function updateAssignment(formData: FormData) {
  const { supabase } = await requireActiveOrg();
  const id = String(formData.get("id") ?? "");
  const programId = String(formData.get("program_id") ?? "");
  const intent = String(formData.get("intent") ?? "");

  if (intent === "remove") {
    await supabase.from("program_assignments").delete().eq("id", id);
  } else if (intent === "active" || intent === "paused" || intent === "completed") {
    const { error } = await supabase
      .from("program_assignments")
      .update({ status: intent })
      .eq("id", id);
    // 23505: reactivating while another active copy exists — leave as is.
    if (error && error.code !== "23505") throw new Error(error.message);
  }
  revalidatePath(`/programs/${programId}`);
}
