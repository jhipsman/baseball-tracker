"use server";

import { downloadCalendar } from "@/lib/imports/fetch-calendar";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { dispatchPush } from "@/lib/push";
import {
  parsePosition,
  STAT_KEYS,
  type RosterPerson,
  type ScheduleEvent,
  type StatLine,
} from "@/lib/imports/smart";
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

// ------------------------------------------------------------------ switching

type Result = { error?: string; batch?: string; summary?: Record<string, number> };
const SOURCES = ["gamechanger", "teamsnap", "leagueapps", "sportsengine", "sheets", "other"];
const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : undefined;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function admin() {
  const ctx = await requireActiveOrg();
  if (ctx.membership.role !== "admin") return { error: "Only team admins can import." } as const;
  return ctx;
}
const fail = (e: { message: string }) => ({
  error: /Only|Import 1|Every game/.test(e.message)
    ? e.message
    : "The import couldn't be saved. Nothing was changed. Try again.",
});

/** Players (made or matched by name), groups, birthdays; optionally invites players and parents. */
export async function importRoster(input: {
  source: string;
  label: string;
  people: RosterPerson[];
  invite: boolean;
}): Promise<Result> {
  const ctx = await admin();
  if ("error" in ctx) return { error: ctx.error };
  if (!Array.isArray(input?.people) || !input.people.length || input.people.length > 1000)
    return { error: "Import 1 to 1,000 players at a time." };
  const people = input.people
    .map((p) => ({
      name: str(p?.name, 80),
      jersey: /^\d{1,2}$/.test(String(p?.jersey ?? "")) ? String(p.jersey) : undefined,
      position: parsePosition(String(p?.position ?? "")) ?? undefined,
      birth_date: DAY.test(String(p?.birth_date ?? "")) ? p.birth_date : undefined,
      group: str(p?.group, 60) || undefined,
      email: EMAIL.test(String(p?.email ?? "")) ? String(p.email).toLowerCase() : undefined,
      parents: (Array.isArray(p?.parents) ? p.parents : [])
        .map((e) => String(e).trim().toLowerCase())
        .filter((e) => EMAIL.test(e) && e.length <= 254)
        .slice(0, 4),
    }))
    .filter((p) => p.name);
  if (!people.length) return { error: "No player names to import." };
  const { data, error } = await ctx.supabase.rpc("import_roster", {
    p_org: ctx.org.id,
    p_source: SOURCES.includes(input.source) ? input.source : "other",
    p_label: str(input.label, 200) ?? "",
    p_people: people as unknown as Json,
    p_invite: !!input.invite,
  });
  if (error) return fail(error);
  if (input.invite) after(() => dispatchPush());
  for (const path of ["/imports", "/roster", "/"]) revalidatePath(path, "layout");
  const { batch, ...summary } = data as Record<string, number> & { batch: string };
  return { batch, summary };
}

/** Games and practices, skipping ones already on the calendar. */
export async function importSchedule(input: {
  source: string;
  label: string;
  events: ScheduleEvent[];
}): Promise<Result> {
  const ctx = await admin();
  if ("error" in ctx) return { error: ctx.error };
  if (!Array.isArray(input?.events) || !input.events.length || input.events.length > 1000)
    return { error: "Import 1 to 1,000 events at a time." };
  const events = input.events.flatMap((e) => {
    const date = String(e?.date ?? "");
    const time = String(e?.time ?? "");
    if (!DAY.test(date) || (time && !/^\d{2}:\d{2}$/.test(time))) return [];
    const kind = e?.kind === "practice" ? "practice" : "game";
    const opponent = str(e?.opponent, 120);
    if (kind === "game" && !opponent) return [];
    return [
      {
        kind,
        opponent,
        title: str(e?.title, 120),
        date,
        time: time || undefined,
        home_away: ["home", "away", "neutral"].includes(String(e?.home_away))
          ? e.home_away
          : "home",
        location: str(e?.location, 200),
        group: str(e?.group, 60),
      },
    ];
  });
  if (!events.length) return { error: "No games or practices with a readable date." };
  const { data, error } = await ctx.supabase.rpc("import_schedule", {
    p_org: ctx.org.id,
    p_source: SOURCES.includes(input.source) ? input.source : "other",
    p_label: str(input.label, 200) ?? "",
    p_events: events as unknown as Json,
  });
  if (error) return fail(error);
  for (const path of ["/imports", "/games", "/practices", "/calendar", "/"])
    revalidatePath(path, "layout");
  const { batch, ...summary } = data as Record<string, number> & { batch: string };
  return { batch, summary };
}

/** Past stat lines, kept as source snapshots and matched to roster players. */
export async function importStats(input: {
  source: string;
  season: string;
  label: string;
  lines: StatLine[];
}): Promise<Result> {
  const ctx = await admin();
  if ("error" in ctx) return { error: ctx.error };
  const season = str(input?.season, 80);
  if (!season) return { error: "Enter a season label, e.g. 2026 Spring." };
  if (!Array.isArray(input?.lines) || !input.lines.length || input.lines.length > 1000)
    return { error: "Import 1 to 1,000 stat lines at a time." };
  if (JSON.stringify(input.lines).length > 900_000)
    return { error: "Split this file into smaller ones." };
  const allowed = new Set(["name", "jersey", "season", "category", ...STAT_KEYS]);
  const lines = input.lines.flatMap((l) => {
    const v = l?.values ?? {};
    const values = Object.fromEntries(
      Object.entries(v)
        .filter(([k, x]) => allowed.has(k) && typeof x === "string" && x.length <= 80)
        .map(([k, x]) => [k, String(x).trim()]),
    );
    values.season ||= season;
    if (!values.name || !["batting", "pitching"].includes(values.category ?? "")) return [];
    if (STAT_KEYS.some((k) => values[k] && !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(values[k]))) return [];
    return [{ key: String(l.key ?? "").slice(0, 600), values }];
  });
  if (!lines.length) return { error: "No stat lines to import." };
  const { data, error } = await ctx.supabase.rpc("import_stats", {
    p_org: ctx.org.id,
    p_source: SOURCES.includes(input.source) ? input.source : "other",
    p_season: season,
    p_label: str(input.label, 200) ?? "",
    p_rows: lines as unknown as Json,
  });
  if (error) return fail(error);
  revalidatePath("/imports");
  const { batch, ...summary } = data as Record<string, number> & { batch: string };
  return { batch, summary };
}

/** Undo an import (keeps anything that's been used since: claimed players, scored games). */
export async function undoImport(batchId: string): Promise<Result> {
  const ctx = await admin();
  if ("error" in ctx) return { error: ctx.error };
  const { data, error } = await ctx.supabase.rpc("undo_import", { p_batch: batchId });
  if (error)
    return { error: /already/.test(error.message) ? error.message : "Couldn't undo. Try again." };
  for (const path of ["/imports", "/roster", "/games", "/practices", "/calendar", "/"])
    revalidatePath(path, "layout");
  return { summary: data as Record<string, number> };
}

export async function fetchCalendar(link: string): Promise<{ error?: string; text?: string }> {
  const ctx = await admin();
  if ("error" in ctx) return { error: ctx.error };
  return downloadCalendar(link);
}
