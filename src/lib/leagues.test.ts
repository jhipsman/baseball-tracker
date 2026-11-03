import { describe, expect, it } from "vitest";
import { clock, matchup, record, result, teamSlug } from "./leagues";

const g = (date: string, us: number | null, them: number | null, status = "final") => ({
  date,
  status,
  team_score: us,
  opponent_score: them,
});

describe("leagues", () => {
  it("makes clean, readable slugs", () => {
    expect(teamSlug("Riverside Rays 14U", "Austin")).toBe("riverside-rays-14u-austin");
    expect(teamSlug("Señor's A&M  Club!!")).toBe("senors-a-and-m-club");
    expect(teamSlug("A")).toBe("team-a");
    expect(teamSlug("x".repeat(80)).length).toBeLessThanOrEqual(60);
  });
  it("reads results only from final games", () => {
    expect(result(g("2027-03-01", 5, 3))).toBe("W");
    expect(result(g("2027-03-01", 2, 2))).toBe("T");
    expect(result(g("2027-03-01", 5, 3, "scheduled"))).toBeNull();
    expect(result(g("2027-03-01", null, null, "final"))).toBeNull();
  });
  it("totals the record, runs and current streak in date order", () => {
    const r = record([
      g("2027-03-04", 1, 4),
      g("2027-03-01", 5, 3),
      g("2027-03-05", 0, 2),
      g("2027-03-02", 6, 6),
      g("2027-03-06", 9, 1, "scheduled"),
    ]);
    expect(r).toMatchObject({
      w: 1,
      l: 2,
      t: 1,
      text: "1-2-1",
      runsFor: 12,
      runsAgainst: 15,
      streak: "L2",
    });
    expect(record([]).text).toBe("0-0");
  });
  it("formats matchups and times", () => {
    expect(matchup({ home_away: "away", opponent: "Eagles" })).toBe("@ Eagles");
    expect(matchup({ home_away: "neutral", opponent: "Eagles" })).toBe("vs Eagles");
    expect([clock("18:30:00"), clock("00:05:00"), clock("12:00:00"), clock(null)]).toEqual([
      "6:30 PM",
      "12:05 AM",
      "12:00 PM",
      "",
    ]);
  });
});
