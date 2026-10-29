import { describe, expect, it } from "vitest";
import {
  addRuns,
  dateRangeLabel,
  directionsUrl,
  ensureInnings,
  escapeIcsText,
  foldIcsLine,
  formatGameTime,
  formatRecord,
  gameIcs,
  gameResult,
  lineTotals,
  matchupLabel,
  normalizeLineScore,
  normalizeUrl,
  parseLineScore,
  recordOf,
  scoreLabel,
  type IcsGame,
} from "./games";

const final = (team: number, opp: number, kind: "league" | "scrimmage" = "league") => ({
  status: "final" as const,
  kind,
  teamScore: team,
  opponentScore: opp,
});

describe("gameResult", () => {
  it("reads W / L / T from a final score", () => {
    expect(gameResult(final(5, 3))).toBe("W");
    expect(gameResult(final(1, 4))).toBe("L");
    expect(gameResult(final(2, 2))).toBe("T");
  });
  it("is null unless the game is final with both scores", () => {
    expect(gameResult({ status: "live", teamScore: 5, opponentScore: 3 })).toBeNull();
    expect(gameResult({ status: "final", teamScore: null, opponentScore: 3 })).toBeNull();
  });
});

describe("recordOf / formatRecord", () => {
  it("counts finals, skipping scrimmages and unfinished games", () => {
    const r = recordOf([
      final(5, 3),
      final(6, 1),
      final(0, 2),
      final(3, 3),
      final(9, 0, "scrimmage"),
      { status: "scheduled", kind: "league", teamScore: null, opponentScore: null },
      { status: "live", kind: "league", teamScore: 4, opponentScore: 0 },
    ]);
    expect(r).toEqual({ w: 2, l: 1, t: 1 });
    expect(formatRecord(r)).toBe("2–1–1");
  });
  it("drops ties when there are none unless asked", () => {
    expect(formatRecord({ w: 8, l: 3, t: 0 })).toBe("8–3");
    expect(formatRecord({ w: 8, l: 3, t: 0 }, true)).toBe("8–3–0");
    expect(formatRecord({ w: 8, l: 3, t: 1 })).toBe("8–3–1");
  });
});

describe("line score", () => {
  it("totals each side", () => {
    expect(
      lineTotals([
        { us: 1, them: 0 },
        { us: 0, them: 2 },
        { us: 3, them: 0 },
      ]),
    ).toEqual({ us: 4, them: 2 });
    expect(lineTotals([])).toEqual({ us: 0, them: 0 });
  });

  it("validates innings", () => {
    expect(parseLineScore([{ us: 1, them: 0 }])).toEqual({ line: [{ us: 1, them: 0 }] });
    expect(parseLineScore([{ us: "2", them: 1 }])).toEqual({ line: [{ us: 2, them: 1 }] });
    expect(parseLineScore("x")).toHaveProperty("error");
    expect(parseLineScore([{ us: -1, them: 0 }])).toHaveProperty("error");
    expect(parseLineScore([{ us: 1.5, them: 0 }])).toHaveProperty("error");
    expect(parseLineScore([null])).toHaveProperty("error");
    expect(parseLineScore(Array.from({ length: 31 }, () => ({ us: 0, them: 0 })))).toHaveProperty(
      "error",
    );
    expect(
      parseLineScore([
        { us: 60, them: 0 },
        { us: 40, them: 0 },
      ]),
    ).toHaveProperty("error");
    expect(normalizeLineScore({ nope: true })).toEqual([]);
  });

  it("pads innings and adds runs in place", () => {
    expect(ensureInnings([], 2)).toEqual([
      { us: 0, them: 0 },
      { us: 0, them: 0 },
    ]);
    let line = addRuns([], 3, "us", 2);
    expect(line).toHaveLength(3);
    expect(line[2]).toEqual({ us: 2, them: 0 });
    line = addRuns(line, 3, "us", -5);
    expect(line[2].us).toBe(0);
    line = addRuns(line, 1, "them", 1);
    expect(lineTotals(line)).toEqual({ us: 0, them: 1 });
  });

  it("never exceeds the 99-run cap", () => {
    const line = addRuns([{ us: 98, them: 0 }], 2, "us", 5);
    expect(lineTotals(line).us).toBe(99);
  });
});

describe("labels", () => {
  it("uses vs / @", () => {
    expect(matchupLabel("home", "Tigers")).toBe("vs Tigers");
    expect(matchupLabel("neutral", "Tigers")).toBe("vs Tigers");
    expect(matchupLabel("away", "Tigers")).toBe("@ Tigers");
  });
  it("formats times", () => {
    expect(formatGameTime("15:30:00")).toBe("3:30 PM");
    expect(formatGameTime("09:05")).toBe("9:05 AM");
    expect(formatGameTime("00:00")).toBe("12:00 AM");
    expect(formatGameTime(null)).toBeNull();
  });
  it("labels scores", () => {
    expect(scoreLabel(final(7, 3))).toBe("W 7–3");
    expect(scoreLabel({ status: "live", teamScore: 2, opponentScore: 1 })).toBe("2–1");
    expect(scoreLabel({ status: "scheduled", teamScore: null, opponentScore: null })).toBeNull();
  });
  it("formats date ranges", () => {
    expect(dateRangeLabel("2026-11-06", "2026-11-08")).toBe("Nov 6–8");
    expect(dateRangeLabel("2026-10-31", "2026-11-02")).toBe("Oct 31 – Nov 2");
    expect(dateRangeLabel("2026-11-07", "2026-11-07")).toBe("Sat, Nov 7");
  });
  it("builds directions links", () => {
    expect(directionsUrl("1 Main St, Town", "Field 2")).toBe(
      "https://www.google.com/maps/search/?api=1&query=1%20Main%20St%2C%20Town",
    );
    expect(directionsUrl(null, "Central Park")).toContain("query=Central%20Park");
    expect(directionsUrl(null, null)).toBeNull();
  });
  it("normalizes bracket links", () => {
    expect(normalizeUrl("example.com/bracket")).toBe("https://example.com/bracket");
    expect(normalizeUrl("http://x.org")).toBe("http://x.org/");
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
  });
});

describe("gameIcs", () => {
  const game: IcsGame = {
    id: "11111111-2222-3333-4444-555555555555",
    opponent: "Tigers, Blue; 12U",
    homeAway: "away",
    date: "2026-11-07",
    startTime: "23:00:00",
    arrivalTime: "22:15:00",
    location: "Field 3",
    address: "1 Main St, Town",
    notes: "Bring both jerseys\nWhite pants",
    status: "scheduled",
    tournamentName: null,
  };
  const now = new Date("2026-10-28T12:34:56.789Z");

  it("escapes text, uses floating local times, and puts arrival in the description", () => {
    const ics = gameIcs(game, { teamName: "Eagles", url: "https://app.test/games/1", now });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTAMP:20261028T123456Z");
    expect(ics).toContain("DTSTART:20261107T230000\r\n");
    // Two hours later rolls into the next day.
    expect(ics).toContain("DTEND:20261108T010000\r\n");
    expect(ics).toContain("SUMMARY:Eagles @ Tigers\\, Blue\\; 12U");
    expect(ics).toContain("LOCATION:Field 3\\, 1 Main St\\, Town");
    expect(ics.replace(/\r\n /g, "")).toContain(
      "DESCRIPTION:Arrive by 10:15 PM\\nBring both jerseys\\nWhite pants\\nhttps://app.test/games/1",
    );
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  it("makes all-day events without a start time and marks cancellations", () => {
    const ics = gameIcs(
      { ...game, startTime: null, arrivalTime: null, notes: null, status: "canceled" },
      { teamName: "Eagles", now },
    );
    expect(ics).toContain("DTSTART;VALUE=DATE:20261107");
    expect(ics).toContain("DTEND;VALUE=DATE:20261108");
    expect(ics).toContain("SUMMARY:CANCELED: Eagles @ Tigers");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).not.toContain("DESCRIPTION");
  });

  it("escapes backslashes and folds long lines at 75 octets", () => {
    expect(escapeIcsText("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
    const folded = foldIcsLine(`DESCRIPTION:${"é".repeat(60)}`);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
    expect(parts.slice(1).every((p) => p.startsWith(" "))).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe(`DESCRIPTION:${"é".repeat(60)}`);
  });
});
