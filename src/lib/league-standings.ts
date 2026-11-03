/**
 * League scores and standings (pure). A league game's score comes from the
 * league admin when they set one; otherwise from the games the two teams have
 * on their own pages (a team on 9D reports straight from live scoring). When
 * both teams report a final and they disagree, the game is disputed and left
 * out of the standings until the admin sets the score.
 */
import type { LeagueGameRow, PublicTeamGame } from "@/types/team-operations";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/** Does an opponent name on a team's page refer to this league team? */
export function nameMatches(opponent: string, teamName: string) {
  const a = norm(opponent);
  const b = norm(teamName);
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  return short.length >= 4 && long.includes(short);
}

export type ScoreSource = "league" | "both" | "home" | "away" | null;
export type ResolvedGame = LeagueGameRow & {
  shown: "scheduled" | "live" | "final" | "disputed" | "postponed" | "canceled";
  home: number | null;
  away: number | null;
  inning: number | null;
  source: ScoreSource;
  /** Both teams' reported finals when they disagree. */
  reported?: { home: [number, number]; away: [number, number] };
};

type Named = { id: string; name: string };

/** Work out every league game's score, using each team report at most once (doubleheaders). */
export function resolveGames(
  games: LeagueGameRow[],
  teams: Named[],
  reports: PublicTeamGame[],
): ResolvedGame[] {
  const name = new Map(teams.map((t) => [t.id, t.name]));
  const used = new Set<string>();
  const find = (teamId: string, date: string, opp: string, time: string | null) => {
    const options = reports.filter(
      (r) =>
        r.team_id === teamId &&
        r.date === date &&
        !used.has(`${r.team_id}:${r.id}`) &&
        nameMatches(r.opponent, opp),
    );
    const pick =
      options.find((r) => time && r.start_time && r.start_time.slice(0, 5) === time.slice(0, 5)) ??
      options[0];
    if (pick) used.add(`${pick.team_id}:${pick.id}`);
    return pick;
  };
  return [...games]
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || (a.start_time ?? "").localeCompare(b.start_time ?? ""),
    )
    .map((g) => {
      const base = { ...g, inning: null, reported: undefined } as const;
      if (g.status !== "scheduled")
        return {
          ...base,
          shown: g.status,
          home: g.home_score,
          away: g.away_score,
          source: g.status === "final" ? "league" : null,
        } satisfies ResolvedGame;
      const h = find(g.home_team_id, g.date, name.get(g.away_team_id) ?? "", g.start_time);
      const a = find(g.away_team_id, g.date, name.get(g.home_team_id) ?? "", g.start_time);
      // Each report as [home runs, away runs].
      const hs =
        h && h.team_score != null && h.opponent_score != null
          ? ([h.team_score, h.opponent_score] as [number, number])
          : null;
      const as =
        a && a.team_score != null && a.opponent_score != null
          ? ([a.opponent_score, a.team_score] as [number, number])
          : null;
      const hFinal = h?.status === "final" && hs;
      const aFinal = a?.status === "final" && as;
      if (hFinal && aFinal) {
        if (hs[0] === as[0] && hs[1] === as[1])
          return {
            ...base,
            shown: "final",
            home: hs[0],
            away: hs[1],
            source: "both",
          } satisfies ResolvedGame;
        return {
          ...base,
          shown: "disputed",
          home: null,
          away: null,
          source: null,
          reported: { home: hs, away: as },
        } satisfies ResolvedGame;
      }
      if (hFinal)
        return {
          ...base,
          shown: "final",
          home: hs[0],
          away: hs[1],
          source: "home",
        } satisfies ResolvedGame;
      if (aFinal)
        return {
          ...base,
          shown: "final",
          home: as[0],
          away: as[1],
          source: "away",
        } satisfies ResolvedGame;
      const live = [h, a].find((r) => r?.status === "live");
      if (live) {
        const s = live === h ? hs : as;
        return {
          ...base,
          shown: "live",
          home: s?.[0] ?? 0,
          away: s?.[1] ?? 0,
          inning: live.inning,
          source: live === h ? "home" : "away",
        } satisfies ResolvedGame;
      }
      const off = [h, a].find((r) => r?.status === "postponed" || r?.status === "canceled");
      if (off)
        return {
          ...base,
          shown: off.status as "postponed" | "canceled",
          home: null,
          away: null,
          source: off === h ? "home" : "away",
        } satisfies ResolvedGame;
      return {
        ...base,
        shown: "scheduled",
        home: null,
        away: null,
        source: null,
      } satisfies ResolvedGame;
    });
}

export type StandingRow = {
  teamId: string;
  gp: number;
  w: number;
  l: number;
  t: number;
  pct: number;
  gb: number;
  rf: number;
  ra: number;
  diff: number;
  streak: string;
};

/** Standings for one group of teams (a division, or the whole league). */
export function standings(teamIds: string[], games: ResolvedGame[]): StandingRow[] {
  const finals = games.filter((g) => g.shown === "final" && g.home != null && g.away != null);
  const rows = teamIds.map((id) => {
    const results: ("W" | "L" | "T")[] = [];
    let rf = 0,
      ra = 0;
    for (const g of finals) {
      const home = g.home_team_id === id;
      if (!home && g.away_team_id !== id) continue;
      const us = home ? g.home! : g.away!;
      const them = home ? g.away! : g.home!;
      rf += us;
      ra += them;
      results.push(us > them ? "W" : us < them ? "L" : "T");
    }
    const w = results.filter((r) => r === "W").length;
    const l = results.filter((r) => r === "L").length;
    const t = results.filter((r) => r === "T").length;
    const gp = results.length;
    let streak = "";
    if (gp) {
      const last = results[gp - 1];
      let n = 0;
      for (let i = gp - 1; i >= 0 && results[i] === last; i--) n++;
      streak = `${last}${n}`;
    }
    return {
      teamId: id,
      gp,
      w,
      l,
      t,
      pct: gp ? (w + t / 2) / gp : 0,
      gb: 0,
      rf,
      ra,
      diff: rf - ra,
      streak,
    };
  });
  rows.sort((a, b) => b.pct - a.pct || b.w - a.w || b.diff - a.diff || a.l - b.l);
  const lead = rows[0];
  if (lead) for (const r of rows) r.gb = (lead.w - r.w + (r.l - lead.l)) / 2;
  return rows;
}

/** ".667", "1.000", ".000". */
export const pctText = (p: number) => (p >= 1 ? "1.000" : p.toFixed(3).replace(/^0/, ""));
/** "—" for the leader, "2.5" otherwise. */
export const gbText = (gb: number) => (gb <= 0 ? "—" : gb % 1 ? gb.toFixed(1) : String(gb));
