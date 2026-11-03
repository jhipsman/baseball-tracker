"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LEVELS, teamSlug } from "@/lib/leagues";
import type { LeagueRow } from "@/types/team-operations";

type R = { error?: string; ok?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const TRY_AGAIN = "That didn't save. Try again.";

const clean = (v: unknown, max: number) =>
  String(v ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);

async function signedIn() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  return id ? { supabase, userId: id } : null;
}

/** The league, if the signed-in person runs it. */
async function admin(leagueId: string) {
  const ctx = await signedIn();
  if (!ctx || !UUID.test(leagueId)) return null;
  const { data } = await ctx.supabase
    .from("leagues")
    .select("id, slug, owner_id")
    .eq("id", leagueId)
    .maybeSingle();
  return data && data.owner_id === ctx.userId ? { ...ctx, league: data } : null;
}

function refresh(slug?: string) {
  revalidatePath("/leagues");
  if (slug) revalidatePath(`/leagues/l/${slug}`, "layout");
}

type LeagueFields = Pick<LeagueRow, "name" | "season" | "level" | "city" | "state">;
function readLeague(fd: FormData): LeagueFields | { error: string } {
  const name = clean(fd.get("name"), 80);
  const level = String(fd.get("level") ?? "") as LeagueRow["level"];
  if (name.length < 2) return { error: "Enter the league's name." };
  if (!LEVELS.some((l) => l.key === level)) return { error: "Choose a level." };
  return {
    name,
    level,
    season: clean(fd.get("season"), 40) || null,
    city: clean(fd.get("city"), 60) || null,
    state: clean(fd.get("state"), 30) || null,
  };
}

export async function createLeague(_: R, fd: FormData): Promise<R> {
  const ctx = await signedIn();
  if (!ctx) redirect("/login?next=/leagues/l/new");
  const fields = readLeague(fd);
  if ("error" in fields) return { error: fields.error };
  const slugBase = teamSlug(fields.name, fields.season);
  // "/leagues/l/new" is the start-a-league page.
  const base = slugBase === "new" ? "new-league" : slugBase;
  for (let i = 0; i < 6; i++) {
    const slug =
      i === 0 ? base : `${base}-${i < 3 ? i + 1 : Math.random().toString(36).slice(2, 6)}`;
    const { error } = await ctx.supabase
      .from("leagues")
      .insert({ ...fields, slug, owner_id: ctx.userId });
    if (!error) {
      refresh(slug);
      redirect(`/leagues/l/${slug}/manage?new=1`);
    }
    if (error.code !== "23505") return { error: TRY_AGAIN };
  }
  return { error: TRY_AGAIN };
}

export async function updateLeague(_: R, fd: FormData): Promise<R> {
  const ctx = await admin(String(fd.get("id") ?? ""));
  if (!ctx) return { error: TRY_AGAIN };
  const fields = readLeague(fd);
  if ("error" in fields) return { error: fields.error };
  const { error } = await ctx.supabase.from("leagues").update(fields).eq("id", ctx.league.id);
  if (error) return { error: TRY_AGAIN };
  refresh(ctx.league.slug);
  return { ok: "Saved." };
}

export async function deleteLeague(id: string): Promise<R> {
  const ctx = await admin(id);
  if (!ctx) return { error: TRY_AGAIN };
  const { error } = await ctx.supabase.from("leagues").delete().eq("id", id);
  if (error) return { error: TRY_AGAIN };
  refresh();
  redirect("/leagues");
}

export async function addDivision(leagueId: string, name: string): Promise<R> {
  const ctx = await admin(leagueId);
  if (!ctx) return { error: TRY_AGAIN };
  const n = clean(name, 60);
  if (!n) return { error: "Name the division." };
  const { count } = await ctx.supabase
    .from("league_divisions")
    .select("id", { count: "exact", head: true })
    .eq("league_id", leagueId);
  const { error } = await ctx.supabase
    .from("league_divisions")
    .insert({ league_id: leagueId, name: n, sort: count ?? 0 });
  if (error) return { error: TRY_AGAIN };
  refresh(ctx.league.slug);
  return { ok: "Division added." };
}

export async function deleteDivision(leagueId: string, divisionId: string): Promise<R> {
  const ctx = await admin(leagueId);
  if (!ctx || !UUID.test(divisionId)) return { error: TRY_AGAIN };
  const { error } = await ctx.supabase
    .from("league_divisions")
    .delete()
    .eq("id", divisionId)
    .eq("league_id", leagueId);
  if (error) return { error: TRY_AGAIN };
  refresh(ctx.league.slug);
  return {};
}

/** Add an existing team page to the league. */
export async function addLeagueTeam(
  leagueId: string,
  teamId: string,
  divisionId: string | null,
): Promise<R> {
  const ctx = await admin(leagueId);
  if (!ctx || !UUID.test(teamId)) return { error: TRY_AGAIN };
  const { error } = await ctx.supabase.from("league_teams").insert({
    league_id: leagueId,
    team_id: teamId,
    division_id: divisionId && UUID.test(divisionId) ? divisionId : null,
  });
  if (error?.code === "23505") return { error: "That team is already in the league." };
  if (error) return { error: TRY_AGAIN };
  refresh(ctx.league.slug);
  return { ok: "Team added." };
}

/** Make a page for a team that doesn't have one yet, and add it (the league admin owns it). */
export async function createLeagueTeam(
  leagueId: string,
  name: string,
  divisionId: string | null,
): Promise<R> {
  const ctx = await admin(leagueId);
  if (!ctx) return { error: TRY_AGAIN };
  const n = clean(name, 80);
  if (n.length < 2) return { error: "Enter the team's name." };
  const { data: league } = await ctx.supabase
    .from("leagues")
    .select("level, city, state")
    .eq("id", leagueId)
    .single();
  const base = teamSlug(n, league?.city);
  let teamId: string | null = null;
  for (let i = 0; i < 6 && !teamId; i++) {
    const slug =
      i === 0 ? base : `${base}-${i < 3 ? i + 1 : Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await ctx.supabase
      .from("public_teams")
      .insert({
        slug,
        name: n,
        level: league?.level ?? "travel",
        city: league?.city ?? null,
        state: league?.state ?? null,
        owner_id: ctx.userId,
      })
      .select("id")
      .single();
    if (data) teamId = data.id;
    else if (error?.code !== "23505") return { error: TRY_AGAIN };
  }
  if (!teamId) return { error: TRY_AGAIN };
  return addLeagueTeam(leagueId, teamId, divisionId);
}

export async function setLeagueTeamDivision(
  leagueId: string,
  teamId: string,
  divisionId: string | null,
): Promise<R> {
  const ctx = await admin(leagueId);
  if (!ctx || !UUID.test(teamId)) return { error: TRY_AGAIN };
  const { error } = await ctx.supabase
    .from("league_teams")
    .update({ division_id: divisionId && UUID.test(divisionId) ? divisionId : null })
    .eq("league_id", leagueId)
    .eq("team_id", teamId);
  if (error) return { error: TRY_AGAIN };
  refresh(ctx.league.slug);
  return {};
}

/** The league admin, or the team's own owner, takes a team out of a league. */
export async function removeLeagueTeam(leagueId: string, teamId: string): Promise<R> {
  const ctx = await signedIn();
  if (!ctx || !UUID.test(leagueId) || !UUID.test(teamId)) return { error: TRY_AGAIN };
  const { data, error } = await ctx.supabase
    .from("league_teams")
    .delete()
    .eq("league_id", leagueId)
    .eq("team_id", teamId)
    .select("league_id");
  if (error || !data.length) return { error: TRY_AGAIN };
  // Its league games go with it (a database trigger, so it works for the team's owner too).
  const { data: l } = await ctx.supabase.from("leagues").select("slug").eq("id", leagueId).single();
  const { data: t } = await ctx.supabase
    .from("public_teams")
    .select("slug")
    .eq("id", teamId)
    .single();
  refresh(l?.slug);
  if (t) revalidatePath(`/leagues/t/${t.slug}`, "layout");
  return { ok: "Removed from the league." };
}

export type LeagueGameInput = {
  date: string;
  time?: string | null;
  home: string;
  away: string;
  location?: string | null;
};

function readGame(g: LeagueGameInput) {
  const time = String(g.time ?? "").slice(0, 5);
  if (!DATE.test(String(g.date))) return null;
  if (!UUID.test(g.home) || !UUID.test(g.away) || g.home === g.away) return null;
  return {
    date: g.date,
    start_time: TIME.test(time) ? time : null,
    home_team_id: g.home,
    away_team_id: g.away,
    location: clean(g.location, 120) || null,
  };
}

export async function addLeagueGame(leagueId: string, g: LeagueGameInput): Promise<R> {
  const ctx = await admin(leagueId);
  if (!ctx) return { error: TRY_AGAIN };
  if (!DATE.test(String(g.date))) return { error: "Pick the date." };
  if (!g.home || !g.away) return { error: "Choose both teams." };
  if (g.home === g.away) return { error: "Pick two different teams." };
  const row = readGame(g);
  if (!row) return { error: TRY_AGAIN };
  const { error } = await ctx.supabase.from("league_games").insert({ ...row, league_id: leagueId });
  if (error) return { error: TRY_AGAIN };
  refresh(ctx.league.slug);
  return { ok: "Game added." };
}

/** Add a whole league schedule (teams already matched to league teams in the browser). */
export async function importLeagueGames(leagueId: string, games: LeagueGameInput[]): Promise<R> {
  const ctx = await admin(leagueId);
  if (!ctx) return { error: TRY_AGAIN };
  if (!Array.isArray(games) || !games.length) return { error: "No games to add." };
  if (games.length > 500) return { error: "Add up to 500 games at a time." };
  const { data: existing } = await ctx.supabase
    .from("league_games")
    .select("date, home_team_id, away_team_id, start_time")
    .eq("league_id", leagueId)
    .limit(5000);
  const key = (d: string, h: string, a: string, t: string | null) =>
    `${d}|${h}|${a}|${(t ?? "").slice(0, 5)}`;
  const seen = new Set(
    (existing ?? []).map((e) => key(e.date, e.home_team_id, e.away_team_id, e.start_time)),
  );
  const rows = [];
  for (const g of games) {
    const row = readGame(g);
    if (!row) continue;
    const k = key(row.date, row.home_team_id, row.away_team_id, row.start_time);
    if (seen.has(k)) continue;
    seen.add(k);
    rows.push({ ...row, league_id: leagueId });
  }
  const skipped = games.length - rows.length;
  if (!rows.length) return { ok: "Those games are already on the schedule." };
  const { error } = await ctx.supabase.from("league_games").insert(rows);
  if (error) return { error: TRY_AGAIN };
  refresh(ctx.league.slug);
  return {
    ok: `Added ${rows.length} game${rows.length === 1 ? "" : "s"}${skipped ? ` (${skipped} already there or unreadable)` : ""}.`,
  };
}

/** The league admin's final say on a game (or back to "use the teams' scores"). */
export async function saveLeagueGame(input: {
  id: string;
  leagueId: string;
  status: "scheduled" | "final" | "postponed" | "canceled";
  home?: number | null;
  away?: number | null;
}): Promise<R> {
  const ctx = await admin(input.leagueId);
  if (!ctx || !UUID.test(input.id)) return { error: TRY_AGAIN };
  if (!["scheduled", "final", "postponed", "canceled"].includes(input.status))
    return { error: TRY_AGAIN };
  const ok = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 99;
  const final = input.status === "final";
  if (final && !(ok(input.home) && ok(input.away)))
    return { error: "Enter both scores (0 to 99)." };
  const { error } = await ctx.supabase
    .from("league_games")
    .update({
      status: input.status,
      home_score: final ? input.home! : null,
      away_score: final ? input.away! : null,
    })
    .eq("id", input.id)
    .eq("league_id", input.leagueId);
  if (error) return { error: TRY_AGAIN };
  refresh(ctx.league.slug);
  return { ok: "Saved." };
}

export async function deleteLeagueGame(leagueId: string, id: string): Promise<R> {
  const ctx = await admin(leagueId);
  if (!ctx || !UUID.test(id)) return { error: TRY_AGAIN };
  const { error } = await ctx.supabase
    .from("league_games")
    .delete()
    .eq("id", id)
    .eq("league_id", leagueId);
  if (error) return { error: TRY_AGAIN };
  refresh(ctx.league.slug);
  return {};
}

/** Team pages to add to a league, by name or city. */
export async function findTeamPages(q: string) {
  const ctx = await signedIn();
  if (!ctx) return [];
  const term = clean(q, 60)
    .replace(/[%_,()*\\]/g, " ")
    .trim();
  if (term.length < 2) return [];
  const { data } = await ctx.supabase
    .from("public_teams")
    .select("id, name, city, state, age_group, verified")
    .or(`name.ilike.%${term}%,city.ilike.%${term}%`)
    .order("verified", { ascending: false })
    .order("name")
    .limit(12);
  return data ?? [];
}
