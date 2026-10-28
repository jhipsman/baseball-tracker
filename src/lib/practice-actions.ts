"use server";

import { after } from "next/server";
import { dispatchPush } from "@/lib/push";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FormState } from "@/lib/auth/actions";
import { requireActiveOrg } from "@/lib/org";
import { loadPractice, toBlocksPayload, type PracticeBlock } from "@/lib/practices";
import type { Database, Json, TablesInsert } from "@/types/database";

type Client = SupabaseClient<Database>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}(:\d{2})?$/;

function revalidateAll(id?: string) {
  revalidatePath("/practices");
  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath("/player");
  if (id) {
    revalidatePath(`/practices/${id}`);
    revalidatePath(`/player/practices/${id}`);
    revalidatePath(`/parent/practices/${id}`);
  }
}

/** Plan details from a form. `template` plans have no date. */
function readFields(formData: FormData, template: boolean) {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const title = str("title").slice(0, 120);
  const date = str("date");
  const start = str("start_time");
  const group = str("group_id");
  if (!title) return { error: "Give the practice a title." } as const;
  if (!template && !DATE.test(date)) return { error: "Choose a date." } as const;
  if (start && !TIME.test(start)) return { error: "Enter a valid start time." } as const;
  return {
    fields: {
      title,
      date: template ? null : date,
      start_time: start || null,
      location: str("location").slice(0, 200) || null,
      group_id: UUID.test(group) ? group : null,
      notes: str("notes").slice(0, 4000) || null,
    },
  } as const;
}

async function insertPlan(
  supabase: Client,
  row: TablesInsert<"practice_plans">,
  blocks: Omit<PracticeBlock, "id">[],
): Promise<{ id: string } | { error: string }> {
  const parsed = toBlocksPayload(blocks);
  if ("error" in parsed) return parsed;
  // Always start unpublished: publishing is an explicit step that notifies the team.
  const { data, error } = await supabase
    .from("practice_plans")
    .insert({ ...row, published: false })
    .select("id")
    .single();
  if (error) return { error: error.message };
  if (parsed.payload.length > 0) {
    const { error: blocksError } = await supabase.rpc("save_practice_blocks", {
      p_plan_id: data.id,
      p_blocks: parsed.payload as Json,
    });
    if (blocksError) return { error: blocksError.message };
  }
  return { id: data.id };
}

/** New practice (or template), optionally copying blocks from a template/plan. */
export async function createPractice(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user, org, isStaff } = await requireActiveOrg();
  if (!isStaff) return { error: "Only staff can create practice plans." };
  const values = Object.fromEntries(
    [...formData.entries()].map(([k, v]) => [k, String(v)]),
  ) as Record<string, string>;

  const asTemplate = formData.get("is_template") === "true";
  const read = readFields(formData, asTemplate);
  if ("error" in read) return { error: read.error, values };

  let blocks: Omit<PracticeBlock, "id">[] = [];
  const fromId = String(formData.get("template_id") ?? "");
  let notes = read.fields.notes;
  if (fromId) {
    const source = await loadPractice(supabase, fromId);
    if (!source || source.orgId !== org.id) return { error: "Template not found.", values };
    blocks = source.blocks;
    notes = notes ?? source.notes;
  }

  const result = await insertPlan(
    supabase,
    { ...read.fields, notes, org_id: org.id, is_template: asTemplate, created_by: user.id },
    blocks,
  );
  if ("error" in result) return { error: result.error, values };
  revalidateAll();
  redirect(`/practices/${result.id}`);
}

/** Edit title/date/time/location/group/notes. */
export async function updatePracticeDetails(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, isStaff } = await requireActiveOrg();
  if (!isStaff) return { error: "Not allowed." };
  const id = String(formData.get("id") ?? "");
  const template = formData.get("is_template") === "true";
  const read = readFields(formData, template);
  if ("error" in read) return { error: read.error };

  const { error } = await supabase.from("practice_plans").update(read.fields).eq("id", id);
  if (error) return { error: error.message };
  revalidateAll(id);
  return { message: "Saved." };
}

/** Atomically replace the plan's blocks (called by the builder's autosave). */
export async function savePracticeBlocks(
  planId: string,
  blocks: Omit<PracticeBlock, "id">[],
): Promise<{ error?: string }> {
  const { supabase, isStaff } = await requireActiveOrg();
  if (!isStaff) return { error: "You don't have permission to edit practice plans." };
  if (!UUID.test(planId)) return { error: "Invalid plan." };
  const parsed = toBlocksPayload(blocks);
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabase.rpc("save_practice_blocks", {
    p_plan_id: planId,
    p_blocks: parsed.payload as Json,
  });
  if (error) return { error: error.message };
  revalidateAll(planId);
  return {};
}

/**
 * Publish / unpublish a practice to the team. Publishing makes it visible to
 * players and parents (whole team or the plan's group); the database trigger
 * `practice_plans_notify` sends them an in-app notification on publish.
 */
export async function setPracticePublished(
  planId: string,
  published: boolean,
): Promise<{ error?: string }> {
  const { supabase, isStaff } = await requireActiveOrg();
  // Push any notifications this action's DB triggers create (no-op without push keys).
  after(() => dispatchPush());
  if (!isStaff) return { error: "Not allowed." };
  if (!UUID.test(planId)) return { error: "Invalid plan." };

  const { data, error } = await supabase
    .from("practice_plans")
    .update({ published })
    .eq("id", planId)
    .eq("is_template", false)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Templates can't be published. Create a practice from it first." };
  revalidateAll(planId);
  return {};
}

/** Copy a plan to a new date (or, with as_template, into Templates). */
export async function duplicatePractice(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user, org, isStaff } = await requireActiveOrg();
  if (!isStaff) return { error: "Not allowed." };
  const source = await loadPractice(supabase, String(formData.get("id") ?? ""));
  if (!source || source.orgId !== org.id) return { error: "Practice not found." };

  const asTemplate = formData.get("as_template") === "true";
  const date = String(formData.get("date") ?? "");
  if (!asTemplate && !DATE.test(date)) return { error: "Choose a date for the copy." };

  const result = await insertPlan(
    supabase,
    {
      org_id: org.id,
      created_by: user.id,
      title: source.title,
      is_template: asTemplate,
      date: asTemplate ? null : date,
      start_time: source.startTime,
      location: source.location,
      group_id: source.groupId,
      notes: source.notes,
    },
    source.blocks,
  );
  if ("error" in result) return { error: result.error };
  revalidateAll();
  redirect(`/practices/${result.id}`);
}

export async function deletePractice(formData: FormData) {
  const { supabase, isStaff } = await requireActiveOrg();
  if (!isStaff) return;
  const id = String(formData.get("id") ?? "");
  const { data } = await supabase
    .from("practice_plans")
    .delete()
    .eq("id", id)
    .select("is_template")
    .maybeSingle();
  revalidateAll(id);
  redirect(data?.is_template ? "/practices?view=templates" : "/practices");
}

/** Add the built-in starter practice templates the org doesn't have yet. */
export async function addStarterPractices() {
  const { supabase, user, org, isStaff } = await requireActiveOrg();
  if (!isStaff) return;
  const { STARTER_PRACTICES } = await import("@/lib/starter-practices");
  const { data: existing } = await supabase
    .from("practice_plans")
    .select("title")
    .eq("org_id", org.id)
    .eq("is_template", true);
  const have = new Set((existing ?? []).map((p) => p.title));

  for (const t of STARTER_PRACTICES) {
    if (have.has(t.title)) continue;
    const result = await insertPlan(
      supabase,
      {
        org_id: org.id,
        created_by: user.id,
        title: t.title,
        notes: t.notes,
        is_template: true,
        date: null,
      },
      t.blocks.map((b) => ({ ...b, details: b.details ?? "", stations: b.stations ?? [] })),
    );
    if ("error" in result) throw new Error(result.error);
  }
  revalidateAll();
  redirect("/practices?view=templates");
}
