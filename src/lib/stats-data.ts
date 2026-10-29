import "server-only";

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums } from "@/types/database";
import { requireActiveOrg } from "@/lib/org";
import { boxName, type BattingLine, type Decision, type PitchingLine } from "@/lib/stats";

type Client = SupabaseClient<Database>;

export type StatsVisibility = "team" | "own";

export type GameRef = {
  id: string;
  orgId: string;
  date: string;
  opponent: string;
  kind: Enums<"game_kind">;
  homeAway: Enums<"home_away">;
  status: Enums<"game_status">;
  teamScore: number | null;
  opponentScore: number | null;
  innings_scheduled: number;
  groupId: string | null;
};

export type BatRow = BattingLine & {
  gameId: string;
  playerId: string;
  battingOrder: number | null;
  position: string | null;
};

export type PitRow = PitchingLine & { gameId: string; playerId: string; sortOrder: number };

export type PlayerName = { id: string; name: string; short: string; jersey: number | null };

const GAME_COLS =
  "id, org_id, date, opponent, kind, home_away, status, team_score, opponent_score, innings_scheduled, group_id";
const BAT_COLS =
  "game_id, player_id, batting_order, position, ab, r, h, doubles, triples, hr, rbi, bb, so, hbp, sb, cs, sac, sf, e";
const PIT_COLS =
  "game_id, player_id, sort_order, outs, h, r, er, bb, so, hbp, hr, pitches, strikes, decision";

type GameRow = Pick<
  Database["public"]["Tables"]["games"]["Row"],
  | "id"
  | "org_id"
  | "date"
  | "opponent"
  | "kind"
  | "home_away"
  | "status"
  | "team_score"
  | "opponent_score"
  | "innings_scheduled"
  | "group_id"
>;
type BatDb = Database["public"]["Tables"]["game_batting"]["Row"];
type PitDb = Database["public"]["Tables"]["game_pitching"]["Row"];

const toGame = (g: GameRow): GameRef => ({
  id: g.id,
  orgId: g.org_id,
  date: g.date,
  opponent: g.opponent,
  kind: g.kind,
  homeAway: g.home_away,
  status: g.status,
  teamScore: g.team_score,
  opponentScore: g.opponent_score,
  innings_scheduled: g.innings_scheduled,
  groupId: g.group_id,
});

const toBat = (r: Omit<BatDb, "id" | "org_id">): BatRow => ({
  gameId: r.game_id,
  playerId: r.player_id,
  battingOrder: r.batting_order,
  position: r.position,
  ab: r.ab,
  r: r.r,
  h: r.h,
  doubles: r.doubles,
  triples: r.triples,
  hr: r.hr,
  rbi: r.rbi,
  bb: r.bb,
  so: r.so,
  hbp: r.hbp,
  sb: r.sb,
  cs: r.cs,
  sac: r.sac,
  sf: r.sf,
  e: r.e,
});

const toPit = (r: Omit<PitDb, "id" | "org_id">): PitRow => ({
  gameId: r.game_id,
  playerId: r.player_id,
  sortOrder: r.sort_order,
  outs: r.outs,
  h: r.h,
  r: r.r,
  er: r.er,
  bb: r.bb,
  so: r.so,
  hbp: r.hbp,
  hr: r.hr,
  pitches: r.pitches,
  strikes: r.strikes,
  decision: (r.decision as Decision | null) ?? null,
});

/** The org's stats setting (not part of the cached membership select). */
export async function loadStatsVisibility(supabase: Client, orgId: string) {
  const { data } = await supabase
    .from("organizations")
    .select("stats_visibility")
    .eq("id", orgId)
    .maybeSingle();
  return (data?.stats_visibility === "own" ? "own" : "team") as StatsVisibility;
}

/** Who is looking, and whether they're limited to their own player's lines. */
export const statsViewer = cache(async () => {
  const ctx = await requireActiveOrg();
  const visibility = await loadStatsVisibility(ctx.supabase, ctx.org.id);
  return { ...ctx, visibility, limited: !ctx.isStaff && visibility === "own" };
});

/** Names (and jersey numbers) for everyone who can appear in a box score. */
export async function loadPlayerNames(supabase: Client, orgId: string, ids?: string[]) {
  const { data } = await supabase
    .from("org_memberships")
    .select("profile_id, jersey_number, profile:profiles (full_name, email)")
    .eq("org_id", orgId)
    .eq("role", "player");
  const names = new Map<string, PlayerName>(
    (data ?? []).map((m) => [
      m.profile_id,
      {
        id: m.profile_id,
        name: m.profile.full_name || m.profile.email,
        short: boxName(m.profile.full_name, m.profile.email),
        jersey: m.jersey_number,
      },
    ]),
  );
  // Players who have since left the team keep their lines.
  const missing = (ids ?? []).filter((id) => !names.has(id));
  if (missing.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", missing);
    for (const p of profiles ?? [])
      names.set(p.id, {
        id: p.id,
        name: p.full_name || p.email,
        short: boxName(p.full_name, p.email),
        jersey: null,
      });
    for (const id of missing)
      if (!names.has(id))
        names.set(id, { id, name: "Former player", short: "Former player", jersey: null });
  }
  return names;
}

/** One game's box score lines (whatever RLS lets the viewer see). */
export async function loadGameLines(supabase: Client, gameId: string) {
  const [{ data: game }, { data: bat, error: be }, { data: pit, error: pe }] = await Promise.all([
    supabase.from("games").select(GAME_COLS).eq("id", gameId).maybeSingle(),
    supabase.from("game_batting").select(BAT_COLS).eq("game_id", gameId),
    supabase.from("game_pitching").select(PIT_COLS).eq("game_id", gameId),
  ]);
  if (be) throw be;
  if (pe) throw pe;
  const batting = (bat ?? [])
    .map(toBat)
    .sort((a, b) => (a.battingOrder ?? 99) - (b.battingOrder ?? 99));
  const pitching = (pit ?? []).map(toPit).sort((a, b) => a.sortOrder - b.sortOrder);
  return { game: game ? toGame(game) : null, batting, pitching };
}

export type SeasonFilter = {
  year: number;
  /** Scrimmages are left out of season stats unless asked for. */
  includeScrimmages?: boolean;
  /** Only this player's lines (game logs). */
  playerId?: string;
};

/**
 * Season lines: every batting/pitching line in games dated in `year`
 * (calendar year), scrimmages excluded by default. `games` lists only games
 * that have at least one visible line, newest first.
 */
export async function loadSeasonLines(supabase: Client, orgId: string, f: SeasonFilter) {
  let gq = supabase
    .from("games")
    .select(GAME_COLS)
    .eq("org_id", orgId)
    .gte("date", `${f.year}-01-01`)
    .lte("date", `${f.year}-12-31`)
    .order("date", { ascending: false });
  if (!f.includeScrimmages) gq = gq.neq("kind", "scrimmage");
  const { data: gameRows, error } = await gq;
  if (error) throw error;
  const ids = (gameRows ?? []).map((g) => g.id);
  if (ids.length === 0)
    return { games: [] as GameRef[], batting: [] as BatRow[], pitching: [] as PitRow[] };

  let bq = supabase.from("game_batting").select(BAT_COLS).eq("org_id", orgId).in("game_id", ids);
  let pq = supabase.from("game_pitching").select(PIT_COLS).eq("org_id", orgId).in("game_id", ids);
  if (f.playerId) {
    bq = bq.eq("player_id", f.playerId);
    pq = pq.eq("player_id", f.playerId);
  }
  const [{ data: bat, error: be }, { data: pit, error: pe }] = await Promise.all([bq, pq]);
  if (be) throw be;
  if (pe) throw pe;
  const batting = (bat ?? []).map(toBat);
  const pitching = (pit ?? []).map(toPit);
  const withLines = new Set([...batting, ...pitching].map((l) => l.gameId));
  const games = (gameRows ?? []).filter((g) => withLines.has(g.id)).map(toGame);
  return { games, batting, pitching };
}

/** Years that have games (newest first), always including `current`. */
export async function loadStatYears(supabase: Client, orgId: string, current: number) {
  const { data } = await supabase.from("games").select("date").eq("org_id", orgId);
  const years = new Set<number>([current]);
  for (const g of data ?? []) years.add(Number(g.date.slice(0, 4)));
  return [...years].sort((a, b) => b - a);
}

export type GameLogEntry = { game: GameRef; bat: BatRow | null; pit: PitRow | null };

/** A player's game-by-game lines for a season, newest first. */
export async function loadPlayerGameLog(
  supabase: Client,
  orgId: string,
  playerId: string,
  f: Omit<SeasonFilter, "playerId">,
) {
  const season = await loadSeasonLines(supabase, orgId, { ...f, playerId });
  const log: GameLogEntry[] = season.games.map((game) => ({
    game,
    bat: season.batting.find((b) => b.gameId === game.id) ?? null,
    pit: season.pitching.find((p) => p.gameId === game.id) ?? null,
  }));
  return { ...season, log };
}

/** `?year=` / `?scrim=1` → a season filter (defaults: this year, no scrimmages). */
export function seasonParams(
  sp: Record<string, string | string[] | undefined>,
  today: string,
): { year: number; includeScrimmages: boolean } {
  const y = typeof sp.year === "string" ? Number(sp.year) : NaN;
  return {
    year: Number.isInteger(y) && y > 1900 && y < 3000 ? y : Number(today.slice(0, 4)),
    includeScrimmages: sp.scrim === "1",
  };
}
