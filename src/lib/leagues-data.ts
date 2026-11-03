import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { PublicTeamGame, PublicTeamRow } from "@/types/team-operations";

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
