"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { gameKey, LEVELS, teamSlug } from "@/lib/leagues";
import type { PublicTeamRow } from "@/types/team-operations";

type R = { error?: string; ok?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const TRY_AGAIN = "That didn't save. Try again.";

const text = (fd: FormData, key: string, max: number) =>
  String(fd.get(key) ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);

async function signedIn() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  return id ? { supabase, userId: id } : null;
}

async function slugOf(supabase: Awaited<ReturnType<typeof createClient>>, teamId: string) {
  const { data } = await supabase
    .from("public_teams")
    .select("slug")
    .eq("id", teamId)
    .maybeSingle();
  return data?.slug;
}

function refresh(slug?: string) {
  revalidatePath("/leagues");
  if (slug) revalidatePath(`/leagues/t/${slug}`, "layout");
}

/** Team details from the form; `link` is "", "org:<id>" or "org:<id>:<group>". */
type TeamFields = Pick<
  PublicTeamRow,
  "name" | "level" | "age_group" | "city" | "state" | "org_id" | "group_id"
>;
function readTeam(fd: FormData): TeamFields | { error: string } {
  const name = text(fd, "name", 80);
  const level = String(fd.get("level") ?? "") as PublicTeamRow["level"];
  const [kind, orgId, groupId] = String(fd.get("link") ?? "").split(":");
  if (name.length < 2) return { error: "Enter the team's name." };
  if (!LEVELS.some((l) => l.key === level)) return { error: "Choose a level." };
  const linked = kind === "org" && UUID.test(orgId ?? "");
  return {
    name,
    level,
    age_group: text(fd, "age_group", 20) || null,
    city: text(fd, "city", 60) || null,
    state: text(fd, "state", 30) || null,
    org_id: linked ? orgId : null,
    group_id: linked && UUID.test(groupId ?? "") ? groupId : null,
  };
}

export async function createTeam(_: R, fd: FormData): Promise<R> {
  const ctx = await signedIn();
  if (!ctx) redirect("/login?next=/leagues/new");
  const team = readTeam(fd);
  if ("error" in team) return { error: team.error };
  const base = teamSlug(team.name, team.city);
  for (let i = 0; i < 6; i++) {
    const slug =
      i === 0 ? base : `${base}-${i < 3 ? i + 1 : Math.random().toString(36).slice(2, 6)}`;
    const { error } = await ctx.supabase
      .from("public_teams")
      .insert({ ...team, slug, owner_id: ctx.userId });
    if (!error) {
      refresh(slug);
      redirect(`/leagues/t/${slug}/manage?new=1`);
    }
    if (error.code !== "23505") return { error: TRY_AGAIN };
    if (error.message.includes("public_teams_one_per_link"))
      return { error: "That 9D team already has a public page." };
  }
  return { error: TRY_AGAIN };
}

export async function updateTeam(_: R, fd: FormData): Promise<R> {
  const ctx = await signedIn();
  if (!ctx) return { error: "Sign in again." };
  const id = String(fd.get("id") ?? "");
  const team = readTeam(fd);
  if ("error" in team) return { error: team.error };
  if (!UUID.test(id)) return { error: TRY_AGAIN };
  const { data, error } = await ctx.supabase
    .from("public_teams")
    .update(team)
    .eq("id", id)
    .select("slug")
    .maybeSingle();
  if (error?.code === "23505") return { error: "That 9D team already has a public page." };
  if (error || !data) return { error: TRY_AGAIN };
  refresh(data.slug);
  return { ok: "Saved." };
}

export async function deleteTeam(id: string): Promise<R> {
  const ctx = await signedIn();
  if (!ctx || !UUID.test(id)) return { error: TRY_AGAIN };
  const { data, error } = await ctx.supabase
    .from("public_teams")
    .delete()
    .eq("id", id)
    .select("id");
  if (error || !data.length) return { error: TRY_AGAIN };
  refresh();
  redirect("/leagues");
}

/** Add a game (with a final score if it's already been played). */
export async function addGame(_: R, fd: FormData): Promise<R> {
  const ctx = await signedIn();
  if (!ctx) return { error: "Sign in again." };
  const teamId = String(fd.get("team_id") ?? "");
  const date = String(fd.get("date") ?? "");
  const time = String(fd.get("start_time") ?? "");
  const opponent = text(fd, "opponent", 80);
  const homeAway = String(fd.get("home_away") ?? "home");
  const us = String(fd.get("team_score") ?? "").trim();
  const them = String(fd.get("opponent_score") ?? "").trim();
  if (!UUID.test(teamId)) return { error: TRY_AGAIN };
  if (!DATE.test(date)) return { error: "Pick the date." };
  if (time && !TIME.test(time)) return { error: "Check the start time." };
  if (!opponent) return { error: "Enter the opponent." };
  if (!["home", "away", "neutral"].includes(homeAway)) return { error: "Choose home or away." };
  const scored = us !== "" || them !== "";
  const score = (s: string) => (/^\d{1,2}$/.test(s) ? Number(s) : null);
  if (scored && (score(us) == null || score(them) == null))
    return { error: "Enter both scores (0 to 99), or leave both empty." };
  const { data, error } = await ctx.supabase
    .from("public_games")
    .insert({
      team_id: teamId,
      date,
      start_time: time || null,
      opponent,
      home_away: homeAway as "home",
      location: text(fd, "location", 120) || null,
      status: scored ? "final" : "scheduled",
      team_score: scored ? score(us) : null,
      opponent_score: scored ? score(them) : null,
    })
    .select("team_id")
    .single();
  if (error) return { error: TRY_AGAIN };
  refresh(await slugOf(ctx.supabase, data.team_id));
  return { ok: "Game added." };
}

/** Enter or fix a score, or mark the game postponed/canceled. */
export async function saveGame(input: {
  id: string;
  status: "scheduled" | "final" | "postponed" | "canceled";
  us?: number | null;
  them?: number | null;
}): Promise<R> {
  const ctx = await signedIn();
  if (!ctx || !UUID.test(input.id)) return { error: TRY_AGAIN };
  if (!["scheduled", "final", "postponed", "canceled"].includes(input.status))
    return { error: TRY_AGAIN };
  const ok = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 99;
  if (input.status === "final" && !(ok(input.us) && ok(input.them)))
    return { error: "Enter both scores (0 to 99)." };
  const final = input.status === "final";
  const { data, error } = await ctx.supabase
    .from("public_games")
    .update({
      status: input.status,
      team_score: final ? input.us! : null,
      opponent_score: final ? input.them! : null,
    })
    .eq("id", input.id)
    .select("team_id")
    .maybeSingle();
  if (error || !data) return { error: TRY_AGAIN };
  refresh(await slugOf(ctx.supabase, data.team_id));
  return { ok: "Saved." };
}

export async function deleteGame(id: string): Promise<R> {
  const ctx = await signedIn();
  if (!ctx || !UUID.test(id)) return { error: TRY_AGAIN };
  const { data, error } = await ctx.supabase
    .from("public_games")
    .delete()
    .eq("id", id)
    .select("team_id");
  if (error || !data.length) return { error: TRY_AGAIN };
  refresh(await slugOf(ctx.supabase, data[0].team_id));
  return {};
}

/** After the browser uploads a logo to team-logos/<team id>/..., point the team at it. */
export async function setLogo(teamId: string, path: string | null): Promise<R> {
  const ctx = await signedIn();
  if (!ctx || !UUID.test(teamId)) return { error: TRY_AGAIN };
  if (
    path !== null &&
    !new RegExp(`^${teamId}/[a-z0-9-]{8,60}\\.(png|jpe?g|webp)$`, "i").test(path)
  )
    return { error: TRY_AGAIN };
  const { data: team } = await ctx.supabase
    .from("public_teams")
    .select("slug, logo_path, owner_id")
    .eq("id", teamId)
    .maybeSingle();
  if (!team || team.owner_id !== ctx.userId) return { error: TRY_AGAIN };
  const { error } = await ctx.supabase
    .from("public_teams")
    .update({ logo_path: path })
    .eq("id", teamId);
  if (error) return { error: TRY_AGAIN };
  if (team.logo_path && team.logo_path !== path)
    await ctx.supabase.storage.from("team-logos").remove([team.logo_path]);
  refresh(team.slug);
  return { ok: path ? "Logo saved." : "Logo removed." };
}

export type ImportGame = {
  date: string;
  time?: string;
  opponent: string;
  home_away?: "home" | "away" | "neutral";
  location?: string;
};

/** Add many games at once (from a file, pasted cells or a calendar link), skipping ones already there. */
export async function importGames(
  teamId: string,
  games: ImportGame[],
): Promise<R & { added?: number; skipped?: number }> {
  const ctx = await signedIn();
  if (!ctx || !UUID.test(teamId)) return { error: TRY_AGAIN };
  if (!Array.isArray(games) || !games.length) return { error: "No games to add." };
  if (games.length > 300) return { error: "Add up to 300 games at a time." };
  const { data: existing } = await ctx.supabase
    .from("public_games")
    .select("date, opponent")
    .eq("team_id", teamId)
    .limit(2000);
  const seen = new Set((existing ?? []).map((g) => gameKey(g.date, g.opponent)));
  const rows = [];
  for (const g of games) {
    const opponent = String(g.opponent ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 80);
    const time = String(g.time ?? "").slice(0, 5);
    if (!DATE.test(String(g.date)) || !opponent) continue;
    const key = gameKey(g.date, opponent);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      team_id: teamId,
      date: g.date,
      start_time: TIME.test(time) ? time : null,
      opponent,
      home_away: (["home", "away", "neutral"].includes(g.home_away ?? "")
        ? g.home_away
        : "home") as "home" | "away" | "neutral",
      location:
        String(g.location ?? "")
          .trim()
          .slice(0, 120) || null,
    });
  }
  const skipped = games.length - rows.length;
  if (!rows.length) return { ok: "Those games are already on your schedule.", added: 0, skipped };
  const { error } = await ctx.supabase.from("public_games").insert(rows);
  if (error) return { error: TRY_AGAIN };
  refresh(await slugOf(ctx.supabase, teamId));
  return {
    ok: `Added ${rows.length} game${rows.length === 1 ? "" : "s"}${skipped ? ` (${skipped} already there or unreadable)` : ""}.`,
    added: rows.length,
    skipped,
  };
}

/** Read a public calendar link for the schedule import. */
export async function fetchTeamCalendar(link: string): Promise<{ error?: string; text?: string }> {
  const ctx = await signedIn();
  if (!ctx) return { error: "Sign in again." };
  const { downloadCalendar } = await import("@/lib/imports/fetch-calendar");
  return downloadCalendar(link);
}
