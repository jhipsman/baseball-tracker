import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { LeagueRow, PublicTeamGame, PublicTeamRow } from "@/types/team-operations";
import { resolveGames } from "@/lib/league-standings";

export type TeamCard = Pick<
  PublicTeamRow,
  "id" | "slug" | "name" | "level" | "age_group" | "city" | "state" | "verified" | "logo_path"
>;
const TEAM_COLUMNS = "id, slug, name, level, age_group, city, state, verified, logo_path";

export const leaguesClient = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims?.sub ?? null };
});

export const teamBySlug = cache(async (slug: string) => {
  const { supabase } = await leaguesClient();
  const { data } = await supabase.from("public_teams").select("*").eq("slug", slug).maybeSingle();
  return data;
});

export async function teamGames(teamId: string) {
  const { supabase } = await leaguesClient();
  const { data } = await supabase.rpc("public_team_games", { p_team: teamId });
  return (data ?? []) as PublicTeamGame[];
}

export type ScoreGame = PublicTeamGame & { team: TeamCard };

/** Every team's games between two dates, with the team attached. */
export async function scoreboard(from: string, to: string): Promise<ScoreGame[]> {
  const { supabase } = await leaguesClient();
  const { data } = await supabase.rpc("public_team_games", { p_from: from, p_to: to });
  const games = (data ?? []) as PublicTeamGame[];
  const ids = [...new Set(games.map((g) => g.team_id))];
  if (!ids.length) return [];
  const { data: teams } = await supabase.from("public_teams").select(TEAM_COLUMNS).in("id", ids);
  const byId = new Map((teams ?? []).map((t) => [t.id, t]));
  return games.flatMap((g) => (byId.has(g.team_id) ? [{ ...g, team: byId.get(g.team_id)! }] : []));
}

/** Team search by name or city. */
export async function searchTeams(q: string): Promise<TeamCard[]> {
  const { supabase } = await leaguesClient();
  const term = q
    .replace(/[%_,()*\\]/g, " ")
    .trim()
    .slice(0, 60);
  if (!term) return [];
  const { data } = await supabase
    .from("public_teams")
    .select(TEAM_COLUMNS)
    .or(`name.ilike.%${term}%,city.ilike.%${term}%,state.ilike.%${term}%`)
    .order("verified", { ascending: false })
    .order("name")
    .limit(40);
  return data ?? [];
}

export async function newestTeams(limit = 8): Promise<TeamCard[]> {
  const { supabase } = await leaguesClient();
  const { data } = await supabase
    .from("public_teams")
    .select(TEAM_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function myTeams(): Promise<TeamCard[]> {
  const { supabase, userId } = await leaguesClient();
  if (!userId) return [];
  const { data } = await supabase
    .from("public_teams")
    .select(TEAM_COLUMNS)
    .eq("owner_id", userId)
    .order("name");
  return data ?? [];
}

/** 9D teams (and their groups) this person runs, for linking a page to them. */
export async function linkableTeams() {
  const { supabase, userId } = await leaguesClient();
  if (!userId) return [];
  const { data: orgs } = await supabase
    .from("org_memberships")
    .select("org:organizations (id, name)")
    .eq("profile_id", userId)
    .eq("role", "admin");
  const list = (orgs ?? []).flatMap((m) => (m.org ? [m.org] : []));
  if (!list.length) return [];
  const { data: groups } = await supabase
    .from("player_groups")
    .select("id, name, org_id")
    .in(
      "org_id",
      list.map((o) => o.id),
    )
    .order("name");
  return list.flatMap((o) => [
    { value: `org:${o.id}`, label: `${o.name} (all games)` },
    ...(groups ?? [])
      .filter((g) => g.org_id === o.id)
      .map((g) => ({ value: `org:${o.id}:${g.id}`, label: `${o.name} · ${g.name}` })),
  ]);
}

// ------------------------------------------------------------------ leagues

export type LeagueCard = Pick<
  LeagueRow,
  "id" | "slug" | "name" | "season" | "level" | "city" | "state"
>;
const LEAGUE_COLUMNS = "id, slug, name, season, level, city, state";

export const leagueBySlug = cache(async (slug: string) => {
  const { supabase } = await leaguesClient();
  const { data } = await supabase.from("leagues").select("*").eq("slug", slug).maybeSingle();
  return data;
});

/** Everything a league page needs: divisions, teams, games with their worked-out scores. */
export async function loadLeague(league: LeagueRow) {
  const { supabase } = await leaguesClient();
  const [{ data: divisions }, { data: members }, { data: games }] = await Promise.all([
    supabase
      .from("league_divisions")
      .select("*")
      .eq("league_id", league.id)
      .order("sort")
      .order("name"),
    supabase.from("league_teams").select("team_id, division_id").eq("league_id", league.id),
    supabase.from("league_games").select("*").eq("league_id", league.id).order("date").limit(2000),
  ]);
  const ids = (members ?? []).map((m) => m.team_id);
  const all = [
    ...new Set([...ids, ...(games ?? []).flatMap((g) => [g.home_team_id, g.away_team_id])]),
  ];
  const { data: teams } = all.length
    ? await supabase.from("public_teams").select(`${TEAM_COLUMNS}, owner_id`).in("id", all)
    : { data: [] };
  const list = games ?? [];
  let reports: PublicTeamGame[] = [];
  if (ids.length && list.length) {
    const { data } = await supabase.rpc("public_teams_games", {
      p_teams: ids,
      p_from: list[0].date,
      p_to: list[list.length - 1].date,
    });
    reports = (data ?? []) as PublicTeamGame[];
  }
  const everyone = (teams ?? []).sort((a, b) => a.name.localeCompare(b.name));
  const resolved = resolveGames(list, everyone, reports);
  const division = new Map((members ?? []).map((m) => [m.team_id, m.division_id]));
  return {
    divisions: divisions ?? [],
    teams: everyone.filter((t) => division.has(t.id)),
    byId: new Map(everyone.map((t) => [t.id, t])),
    division,
    games: resolved,
  };
}

export async function searchLeagues(q: string): Promise<LeagueCard[]> {
  const { supabase } = await leaguesClient();
  const term = q
    .replace(/[%_,()*\\]/g, " ")
    .trim()
    .slice(0, 60);
  if (!term) return [];
  const { data } = await supabase
    .from("leagues")
    .select(LEAGUE_COLUMNS)
    .or(`name.ilike.%${term}%,city.ilike.%${term}%,state.ilike.%${term}%`)
    .order("name")
    .limit(20);
  return data ?? [];
}

export async function newestLeagues(limit = 6): Promise<LeagueCard[]> {
  const { supabase } = await leaguesClient();
  const { data } = await supabase
    .from("leagues")
    .select(LEAGUE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function myLeagues(): Promise<LeagueCard[]> {
  const { supabase, userId } = await leaguesClient();
  if (!userId) return [];
  const { data } = await supabase
    .from("leagues")
    .select(LEAGUE_COLUMNS)
    .eq("owner_id", userId)
    .order("name");
  return data ?? [];
}

/** Leagues a team plays in. */
export async function leaguesForTeam(teamId: string): Promise<LeagueCard[]> {
  const { supabase } = await leaguesClient();
  const { data: rows } = await supabase
    .from("league_teams")
    .select("league_id")
    .eq("team_id", teamId);
  const ids = (rows ?? []).map((r) => r.league_id);
  if (!ids.length) return [];
  const { data } = await supabase
    .from("leagues")
    .select(LEAGUE_COLUMNS)
    .in("id", ids)
    .order("name");
  return data ?? [];
}
