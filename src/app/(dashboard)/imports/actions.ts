"use server";
import { revalidatePath } from "next/cache";
import { requireActiveOrg } from "@/lib/org";
import { validateRows, type ImportKind, type ImportSource } from "@/lib/imports/parse";
import type { Json } from "@/types/database";
export async function saveImport(input: {
  kind: ImportKind;
  source: ImportSource;
  season: string;
  rows: Record<string, string>[];
}): Promise<{ error?: string; saved?: number; skipped?: number }> {
  const { supabase, org, membership } = await requireActiveOrg();
  if (membership.role !== "admin") return { error: "Only team admins can import data." };
  if (
    !input ||
    !["roster", "schedule", "stats"].includes(input.kind) ||
    !["sheets", "excel", "gamechanger", "other"].includes(input.source) ||
    typeof input.season !== "string" ||
    !Array.isArray(input.rows)
  )
    return { error: "Invalid import." };
  if (JSON.stringify(input).length > 900_000)
    return { error: "Split this import into smaller files (under 900 KB of mapped data)." };
  if (
    input.rows.some(
      (row) =>
        !row ||
        typeof row !== "object" ||
        Array.isArray(row) ||
        Object.values(row).some((v) => typeof v !== "string"),
    )
  )
    return { error: "Invalid row data." };
  const checked = validateRows(input.kind, input.rows, input.season);
  if (checked.errors.length) return { error: checked.errors.slice(0, 4).join(" ") };
  const { data, error } = await supabase.rpc("import_team_rows", {
    p_org: org.id,
    p_kind: input.kind,
    p_source: input.source,
    p_season: input.season.trim(),
    p_rows: checked.rows as unknown as Json,
  });
  if (error)
    return {
      error:
        "Import could not be saved. Your existing data was not changed. Please try again shortly.",
    };
  for (const path of ["/imports", "/games", "/calendar", "/"]) revalidatePath(path);
  const result = data as { saved: number; skipped: number };
  return { ...result, skipped: result.skipped + checked.duplicates };
}
