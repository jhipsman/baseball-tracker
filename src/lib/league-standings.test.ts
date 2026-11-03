import { describe, expect, it } from "vitest";
import {
  dedupeMirrors,
  disputeScores,
  gbText,
  nameMatches,
  pctText,
  resolveGames,
  standings,
} from "./league-standings";
import type { LeagueGameRow, PublicTeamGame } from "@/types/team-operations";

const teams = [
  { id: "rays", name: "Riverside Rays 14U" },
  { id: "eagles", name: "Eagles" },
  { id: "hawks", name: "Lakeside Hawks" },
];
let n = 0;
const lg = (p: Partial<LeagueGameRow>): LeagueGameRow => ({
  id: `g${++n}`,
  league_id: "L",
  date: "2027-03-14",
  start_time: null,
  home_team_id: "rays",
  away_team_id: "eagles",
  location: null,
  status: "scheduled",
  home_score: null,
  away_score: null,
  created_at: "",
  ...p,
});
const rep = (p: Partial<PublicTeamGame>): PublicTeamGame => ({
  id: `r${++n}`,
  team_id: "rays",
  date: "2027-03-14",
  start_time: null,
  opponent: "Eagles",
  home_away: "home",
  location: null,
  status: "final",
  team_score: 5,
  opponent_score: 2,
  inning: null,
  opponent_team_id: null,
  mirror: false,
  alt_team_score: null,
  alt_opponent_score: null,
  alt_is_ours: null,
  ...p,
});

describe("shared games", () => {
  it("drops another team's copy of a game this team already has", () => {
    const own = rep({ opponent: "Eagles" });
    const copy = rep({ mirror: true, opponent: "Eagles", opponent_team_id: "eagles" });
    const other = rep({ mirror: true, opponent: "Lakeside Hawks", opponent_team_id: "hawks" });
    expect(dedupeMirrors([own, copy, other])).toEqual([own, other]);
    // A doubleheader at different times keeps both.
    const late = rep({ mirror: true, start_time: "18:00:00", opponent_team_id: "eagles" });
    expect(dedupeMirrors([rep({ start_time: "13:00" }), late])).toHaveLength(2);
  });
  it("reads a dispute from either side", () => {
    const g = rep({ status: "disputed", alt_team_score: 4, alt_opponent_score: 2 });
    expect(disputeScores({ ...g, alt_is_ours: false })).toEqual({ ours: [5, 2], theirs: [4, 2] });
    expect(disputeScores({ ...g, alt_is_ours: true })).toEqual({ ours: [4, 2], theirs: [5, 2] });
  });
  it("shows a disputed shared game with each team's report, home first", () => {
    // Rays (home) say 5-2; Eagles say Eagles 3, Rays 5. Seen from the Eagles' copy.
    const [g] = resolveGames([lg({})], teams, [
      rep({
        id: "x",
        team_id: "eagles",
        mirror: true,
        opponent: "Riverside Rays 14U",
        home_away: "away",
        status: "disputed",
        team_score: 2,
        opponent_score: 5,
        alt_team_score: 3,
        alt_opponent_score: 5,
        alt_is_ours: true,
      }),
    ]);
    expect(g).toMatchObject({ shown: "disputed", reported: { home: [5, 2], away: [5, 3] } });
    const [rows] = [standings(["rays", "eagles"], [g])];
    expect(rows.every((r) => r.gp === 0)).toBe(true);
  });
});

describe("league scores", () => {
  it("matches opponent names loosely but not too loosely", () => {
    expect(nameMatches("Eagles", "Eagles")).toBe(true);
    expect(nameMatches("Riverside Rays", "Riverside Rays 14U")).toBe(true);
    expect(nameMatches("the EAGLES!", "Eagles")).toBe(true);
    expect(nameMatches("Ray", "Riverside Rays 14U")).toBe(false);
    expect(nameMatches("Hawks", "Eagles")).toBe(false);
  });
  it("takes one team's report, or both when they agree", () => {
    const [one] = resolveGames([lg({})], teams, [rep({})]);
    expect(one).toMatchObject({ shown: "final", home: 5, away: 2, source: "home" });
    const [both] = resolveGames([lg({})], teams, [
      rep({}),
      rep({
        team_id: "eagles",
        opponent: "Riverside Rays",
        home_away: "away",
        team_score: 2,
        opponent_score: 5,
      }),
    ]);
    expect(both).toMatchObject({ shown: "final", home: 5, away: 2, source: "both" });
  });
  it("flags a dispute when the teams disagree, and the admin's score wins", () => {
    const reports = [
      rep({}),
      rep({ team_id: "eagles", opponent: "Rays", team_score: 6, opponent_score: 5 }),
    ];
    const [d] = resolveGames([lg({})], teams, reports);
    expect(d.shown).toBe("disputed");
    expect(d.reported).toEqual({ home: [5, 2], away: [5, 6] });
    const [fixed] = resolveGames(
      [lg({ status: "final", home_score: 5, away_score: 6 })],
      teams,
      reports,
    );
    expect(fixed).toMatchObject({ shown: "final", home: 5, away: 6, source: "league" });
  });
  it("shows live games and uses each report once in a doubleheader", () => {
    const [live] = resolveGames([lg({})], teams, [
      rep({ status: "live", team_score: 1, opponent_score: 0, inning: 3 }),
    ]);
    expect(live).toMatchObject({ shown: "live", home: 1, away: 0, inning: 3 });
    const games = resolveGames(
      [lg({ start_time: "13:00:00" }), lg({ start_time: "10:00:00" })],
      teams,
      [
        rep({ start_time: "13:00:00", team_score: 1, opponent_score: 9 }),
        rep({ start_time: "10:00:00", team_score: 4, opponent_score: 3 }),
      ],
    );
    expect(games.map((g) => [g.start_time, g.home, g.away])).toEqual([
      ["10:00:00", 4, 3],
      ["13:00:00", 1, 9],
    ]);
  });
  it("ignores reports from the wrong date or opponent", () => {
    const [g] = resolveGames([lg({})], teams, [
      rep({ date: "2027-03-15" }),
      rep({ opponent: "Hawks" }),
    ]);
    expect(g.shown).toBe("scheduled");
  });
});

describe("standings", () => {
  it("ranks by win %, with games back, runs and streaks", () => {
    const games = resolveGames(
      [
        lg({ status: "final", home_score: 5, away_score: 2 }),
        lg({
          date: "2027-03-15",
          home_team_id: "hawks",
          away_team_id: "rays",
          status: "final",
          home_score: 3,
          away_score: 3,
        }),
        lg({
          date: "2027-03-16",
          home_team_id: "eagles",
          away_team_id: "hawks",
          status: "final",
          home_score: 1,
          away_score: 8,
        }),
        lg({ date: "2027-03-17", status: "scheduled" }),
      ],
      teams,
      [],
    );
    const rows = standings(["rays", "eagles", "hawks"], games);
    expect(
      rows.map((r) => [r.teamId, r.w, r.l, r.t, pctText(r.pct), gbText(r.gb), r.diff, r.streak]),
    ).toEqual([
      ["hawks", 1, 0, 1, ".750", "—", 7, "W1"],
      ["rays", 1, 0, 1, ".750", "—", 3, "T1"],
      ["eagles", 0, 2, 0, ".000", "1.5", -10, "L2"],
    ]);
    expect(pctText(1)).toBe("1.000");
    expect(gbText(1.5)).toBe("1.5");
  });
});
