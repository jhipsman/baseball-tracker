"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/auth/actions";
import { requireActiveOrg } from "@/lib/org";
import { METRICS, METRIC_BY_KEY } from "@/constants/metrics";

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Parse and range-check one metric value; returns [value] or an error string. */
function parseValue(key: string, raw: string): number | string | null {
  const m = METRIC_BY_KEY.get(key);
  const t = raw.trim();
  if (!m || t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return `${m.label}: "${t}" isn't a number.`;
  if (n < m.min || n > m.max) return `${m.label} must be between ${m.min} and ${m.max} ${m.unit}.`;
  return Math.round(n * 10 ** m.decimals) / 10 ** m.decimals;
}

export async function addAssessment(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user, org, isStaff } = await requireActiveOrg();
  if (!isStaff) return { error: "Only coaches can record assessments." };

  const playerId = String(formData.get("player_id") ?? "");
  const date = String(formData.get("assessment_date") ?? "");
  const notes = String(formData.get("notes") ?? "")
    .trim()
    .slice(0, 2000);
  if (!isDate(date)) return { error: "Choose a date." };

  const data: Record<string, number> = {};
  for (const m of METRICS) {
    const v = parseValue(m.key, String(formData.get(m.key) ?? ""));
    if (typeof v === "string") return { error: v };
    if (typeof v === "number") data[m.key] = v;
  }
  if (Object.keys(data).length === 0) return { error: "Enter at least one number." };

  const { error } = await supabase.from("assessments").insert({
    org_id: org.id,
    player_id: playerId,
    assessed_by: user.id,
    assessment_date: date,
    data,
    notes: notes || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/roster", "layout");
  return {
    message: `Saved ${Object.keys(data).length} result${Object.keys(data).length === 1 ? "" : "s"}.`,
  };
}

export async function deleteAssessment(formData: FormData) {
  const { supabase, org } = await requireActiveOrg();
  await supabase
    .from("assessments")
    .delete()
    .eq("id", String(formData.get("id") ?? ""))
    .eq("org_id", org.id);
  revalidatePath("/roster", "layout");
}

/** Team testing grid: inputs named v:<playerId>:<metricKey>. One assessment per player with values. */
export async function saveTestingDay(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user, org, isStaff } = await requireActiveOrg();
  if (!isStaff) return { error: "Only coaches can record assessments." };
  const date = String(formData.get("assessment_date") ?? "");
  if (!isDate(date)) return { error: "Choose a date." };

  const byPlayer = new Map<string, Record<string, number>>();
  for (const [name, raw] of formData.entries()) {
    const match = /^v:([0-9a-f-]{36}):([a-z_]+)$/.exec(name);
    if (!match) continue;
    const v = parseValue(match[2], String(raw));
    if (typeof v === "string") return { error: v };
    if (typeof v !== "number") continue;
    byPlayer.set(match[1], { ...(byPlayer.get(match[1]) ?? {}), [match[2]]: v });
  }
  if (byPlayer.size === 0) return { error: "Enter at least one result." };

  const { error } = await supabase.from("assessments").insert(
    [...byPlayer].map(([player_id, data]) => ({
      org_id: org.id,
      player_id,
      assessed_by: user.id,
      assessment_date: date,
      data,
      notes: "Testing day",
    })),
  );
  if (error) return { error: error.message };

  revalidatePath("/roster", "layout");
  return {
    message: `Saved results for ${byPlayer.size} player${byPlayer.size === 1 ? "" : "s"}.`,
  };
}
