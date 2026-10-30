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
    !["sheets", "excel", "gamechanger", "leagueapps", "other"].includes(input.source) ||
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
  if (input.kind === "schedule" && checked.rows.some((r) => r.values.group?.trim())) {
    const { data: groups, error } = await supabase
      .from("player_groups")
      .select("id,name")
      .eq("org_id", org.id);
    if (error) return { error: "Roster groups could not be checked. Try again." };
    const mismatch = checked.rows.find(
      (r) =>
        r.values.group?.trim() &&
        (groups ?? []).filter(
          (g) => g.name.trim().toLowerCase() === r.values.group.trim().toLowerCase(),
        ).length !== 1,
    );
    if (mismatch)
      return {
        error: `Choose an existing roster group for ${mismatch.values.group}, or leave the group empty.`,
      };
  }
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

export async function linkImportedPlayer(input: {
  rowId: string;
  playerId: string;
}): Promise<{ error?: string }> {
  const { org, membership, supabase } = await requireActiveOrg();
  if (membership.role !== "admin") return { error: "Only admins can link imported players." };
  const { error } = await supabase.rpc("link_imported_player", {
    p_org: org.id,
    p_row: input.rowId,
    p_player: input.playerId,
  });
  if (error)
    return {
      error:
        "The player could not be linked. Choose a player on this team; an existing link cannot be overwritten.",
    };
  revalidatePath("/imports");
  revalidatePath("/roster");
  return {};
}
