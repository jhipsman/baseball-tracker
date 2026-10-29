import { describe, expect, it } from "vitest";
import {
  battingRates,
  battingSummary,
  boxFootnotes,
  boxName,
  combinePitching,
  emptyBatting,
  emptyPitching,
  eraLabel,
  fmtAvg,
  fmtPct,
  fmtRate,
  formatIP,
  parseIP,
  pitchingRates,
  pitchingSummary,
  plateAppearances,
  qualifiers,
  regulationInnings,
  seasonByPlayer,
  sumBatting,
  sumPitching,
  totalBases,
  validateBatting,
  validateBoxScore,
  validatePitching,
  type BattingLine,
  type PitchingLine,
} from "./stats";

const bat = (o: Partial<BattingLine>): BattingLine => ({ ...emptyBatting(), ...o });
const pit = (o: Partial<PitchingLine>): PitchingLine => ({ ...emptyPitching(), ...o });

describe("innings pitched", () => {
  it("formats outs as baseball IP", () => {
    expect(formatIP(0)).toBe("0.0");
    expect(formatIP(1)).toBe("0.1");
    expect(formatIP(14)).toBe("4.2");
    expect(formatIP(17)).toBe("5.2");
    expect(formatIP(21)).toBe("7.0");
  });

  it("parses typed IP into outs", () => {
    expect(parseIP("5.2")).toBe(17);
    expect(parseIP("5.1")).toBe(16);
    expect(parseIP("5")).toBe(15);
    expect(parseIP("5.0")).toBe(15);
    expect(parseIP("4.2")).toBe(14);
    expect(parseIP(" 0.1 ")).toBe(1);
    expect(parseIP(".2")).toBe(2);
    expect(parseIP("")).toBe(0);
  });

  it("rejects impossible IP", () => {
    expect(parseIP(".3")).toBeNull();
    expect(parseIP("5.3")).toBeNull();
    expect(parseIP("5.5")).toBeNull();
    expect(parseIP("4.67")).toBeNull();
    expect(parseIP("-1")).toBeNull();
    expect(parseIP("abc")).toBeNull();
    expect(parseIP(".")).toBeNull();
    expect(parseIP("5.")).toBeNull();
  });

  it("round-trips", () => {
    for (let o = 0; o < 60; o++) expect(parseIP(formatIP(o))).toBe(o);
  });
});

describe("batting", () => {
  // Game 1: 2-for-4, 2B, BB. Game 2: 1-for-3, HR, HBP, SF.
  const lines = [
    bat({ ab: 4, h: 2, doubles: 1, bb: 1, r: 1, rbi: 1, so: 1 }),
    bat({ ab: 3, h: 1, hr: 1, hbp: 1, sf: 1, r: 1, rbi: 3, sb: 2 }),
  ];
  const t = sumBatting(lines);

  it("sums lines", () => {
    expect(t).toMatchObject({
      g: 2,
      ab: 7,
      h: 3,
      doubles: 1,
      hr: 1,
      bb: 1,
      hbp: 1,
      sf: 1,
      rbi: 4,
      sb: 2,
    });
  });

  it("computes total bases and PA", () => {
    expect(totalBases(t)).toBe(1 + 2 + 4); // single + double + HR
    expect(plateAppearances(t)).toBe(7 + 1 + 1 + 1);
    expect(plateAppearances(bat({ ab: 3, sac: 1 }))).toBe(4);
  });

  it("computes AVG / OBP / SLG / OPS", () => {
    const r = battingRates(t);
    expect(r.avg).toBeCloseTo(3 / 7);
    expect(r.obp).toBeCloseTo((3 + 1 + 1) / (7 + 1 + 1 + 1));
    expect(r.slg).toBeCloseTo(7 / 7);
    expect(r.ops).toBeCloseTo(0.5 + 1);
    expect(r.pa).toBe(10);
  });

  it("sacrifice bunts don't count against OBP, sac flies do", () => {
    expect(battingRates(bat({ ab: 2, h: 1, sac: 1 })).obp).toBeCloseTo(0.5);
    expect(battingRates(bat({ ab: 2, h: 1, sf: 1 })).obp).toBeCloseTo(1 / 3);
  });

  it("returns null when there's no data", () => {
    const r = battingRates(emptyBatting());
    expect(r).toMatchObject({ avg: null, obp: null, slg: null, ops: null, pa: 0 });
    // Walk-only line: OBP 1.000, no AVG/SLG.
    const w = battingRates(bat({ bb: 2 }));
    expect(w.avg).toBeNull();
    expect(w.obp).toBe(1);
    expect(w.ops).toBe(1);
  });
});

describe("pitching", () => {
  const lines = [
    pit({ outs: 14, h: 5, r: 3, er: 2, bb: 2, so: 6, pitches: 78, strikes: 50, decision: "W" }),
    pit({ outs: 7, h: 2, r: 1, er: 1, bb: 1, so: 3, pitches: 40, strikes: null }),
    pit({ outs: 3, h: 0, so: 1, pitches: null }),
  ];
  const t = sumPitching(lines);

  it("sums lines and decisions", () => {
    expect(t).toMatchObject({
      app: 3,
      outs: 24,
      h: 7,
      r: 4,
      er: 3,
      bb: 3,
      so: 10,
      pitches: 118,
      strikes: 50,
      w: 1,
      l: 0,
    });
    expect(t.pitchedCounted).toBe(2);
    expect(combinePitching([t, t])).toMatchObject({ app: 6, outs: 48, er: 6, w: 2, pitches: 236 });
  });

  it("computes ERA scaled to the regulation game", () => {
    const r7 = pitchingRates(t, 7);
    expect(r7.ip).toBeCloseTo(8);
    expect(r7.era).toBeCloseTo((3 * 7) / 8);
    expect(r7.whip).toBeCloseTo(10 / 8);
    expect(r7.kPerN).toBeCloseTo((10 * 7) / 8);
    expect(r7.bbPerN).toBeCloseTo((3 * 7) / 8);
    expect(r7.kbb).toBeCloseTo(10 / 3);
    expect(pitchingRates(t, 9).era).toBeCloseTo((3 * 9) / 8);
    expect(pitchingRates(t).n).toBe(7);
  });

  it("4.2 IP with 2 ER is a 3.00 ERA over 7 innings", () => {
    const r = pitchingRates(sumPitching([pit({ outs: parseIP("4.2")!, er: 2, r: 2 })]), 7);
    expect(fmtRate(r.era)).toBe("3.00");
  });

  it("handles zero innings", () => {
    const z = pitchingRates(sumPitching([pit({ outs: 0, er: 2, r: 2, h: 3 })]));
    expect(z.era).toBe(Infinity);
    expect(fmtRate(z.era)).toBe("∞");
    const none = pitchingRates(sumPitching([]));
    expect(none.era).toBeNull();
    expect(none.whip).toBeNull();
    expect(none.kbb).toBeNull();
    expect(fmtRate(none.era)).toBe("—");
  });

  it("picks the most common game length", () => {
    expect(regulationInnings([])).toBe(7);
    expect(regulationInnings([], 9)).toBe(9);
    expect(
      regulationInnings([
        { innings_scheduled: 6 },
        { innings_scheduled: 6 },
        { innings_scheduled: 7 },
      ]),
    ).toBe(6);
    expect(regulationInnings([{ innings_scheduled: 6 }, { innings_scheduled: 9 }])).toBe(9);
    expect(eraLabel(7)).toBe("ERA (7 inn)");
  });
});

describe("formatting", () => {
  it("formats averages baseball-style", () => {
    expect(fmtAvg(1 / 3)).toBe(".333");
    expect(fmtAvg(0)).toBe(".000");
    expect(fmtAvg(1)).toBe("1.000");
    expect(fmtAvg(1.5)).toBe("1.500");
    expect(fmtAvg(0.9996)).toBe("1.000");
    expect(fmtAvg(null)).toBe("—");
    expect(fmtAvg(undefined)).toBe("—");
    expect(fmtAvg(Infinity)).toBe("—");
  });

  it("formats rates", () => {
    expect(fmtRate(3.5)).toBe("3.50");
    expect(fmtRate(0)).toBe("0.00");
    expect(fmtRate(1.234, 1)).toBe("1.2");
    expect(fmtRate(null)).toBe("—");
    expect(fmtRate(NaN)).toBe("—");
    expect(fmtPct(50, 78)).toBe("64%");
    expect(fmtPct(0, 0)).toBe("—");
  });

  it("formats names and summaries", () => {
    expect(boxName("Jamie Lee Smith")).toBe("J. Lee Smith");
    expect(boxName("Cher")).toBe("Cher");
    expect(boxName(null, "kid@x.com")).toBe("kid");
    expect(battingSummary(bat({ ab: 3, h: 2, hr: 1, r: 1, rbi: 2, bb: 1 }))).toBe(
      "2-for-3, HR, R, 2 RBI, BB",
    );
    expect(
      pitchingSummary(pit({ outs: 14, h: 3, er: 1, bb: 2, so: 6, pitches: 70, decision: "W" })),
    ).toBe("W, 4.2 IP, 3 H, 1 ER, 2 BB, 6 K, 70 P");
  });

  it("builds newspaper footnotes", () => {
    expect(
      boxFootnotes([
        { name: "A. One", doubles: 2, triples: 0, hr: 0, sb: 1, e: 0 },
        { name: "B. Two", doubles: 1, triples: 0, hr: 1, sb: 0, e: 1 },
      ]),
    ).toEqual([
      { label: "2B", text: "A. One 2, B. Two" },
      { label: "HR", text: "B. Two" },
      { label: "SB", text: "A. One" },
      { label: "E", text: "B. Two" },
    ]);
  });

  it("sets qualification minimums per team game", () => {
    expect(qualifiers(10)).toEqual({ minPA: 20, minOuts: 30 });
  });
});

describe("validation", () => {
  it("accepts a normal batting line", () => {
    expect(validateBatting(bat({ ab: 4, h: 2, doubles: 1, so: 1, rbi: 2 }))).toEqual({});
  });

  it("mirrors the DB checks", () => {
    expect(validateBatting(bat({ ab: 2, h: 3 })).h).toMatch(/hits than at-bats/);
    expect(validateBatting(bat({ ab: 2, so: 3 })).so).toMatch(/strikeouts/);
    expect(validateBatting(bat({ ab: 3, h: 2, so: 2 })).so).toMatch(/exceed at-bats/);
    expect(validateBatting(bat({ ab: 4, h: 1, doubles: 1, hr: 1 })).hr).toMatch(
      /can't exceed hits/,
    );
    expect(validateBatting(bat({ ab: 16 })).ab).toMatch(/0–15/);
    expect(validateBatting(bat({ rbi: 20 })).rbi).toBeUndefined();
    expect(validateBatting(bat({ r: -1 })).r).toBeDefined();
    expect(validateBatting(bat({ r: 1.5 })).r).toBeDefined();
  });

  it("checks pitching lines", () => {
    expect(
      validatePitching(pit({ outs: 14, h: 3, r: 2, er: 2, pitches: 70, strikes: 45 })),
    ).toEqual({});
    expect(validatePitching(pit({ r: 1, er: 2 })).er).toBeDefined();
    expect(validatePitching(pit({ h: 1, hr: 2 })).hr).toBeDefined();
    expect(validatePitching(pit({ pitches: 40, strikes: 41 })).strikes).toBeDefined();
    expect(validatePitching(pit({ pitches: 251 })).pitches).toBeDefined();
    expect(validatePitching(pit({ outs: 91 })).ip).toBeDefined();
    expect(validatePitching(pit({ strikes: 30 }))).toEqual({});
  });

  const row = (id: string, o: Partial<BattingLine> = {}, order: number | null = null) => ({
    ...bat(o),
    player_id: id,
    batting_order: order,
  });

  it("validates a whole box score with team-level warnings", () => {
    const res = validateBoxScore({
      batting: [row("a", { ab: 3, h: 1, r: 1 }, 1), row("b", { ab: 3, r: 1 }, 2)],
      pitching: [{ ...pit({ outs: 21, r: 3, decision: "W" }), player_id: "p" }],
      teamScore: 4,
      opponentScore: 3,
    });
    expect(res.ok).toBe(true);
    expect(res.warnings.some((w) => /add up to 2.*says 4/.test(w))).toBe(true);
    expect(res.warnings.some((w) => /isn't a win/.test(w))).toBe(false); // 4-3 is a win
  });

  it("blocks cell errors and impossible decisions", () => {
    const res = validateBoxScore({
      batting: [row("a", { ab: 1, h: 2 })],
      pitching: [
        { ...pit({ decision: "W" }), player_id: "p" },
        { ...pit({ decision: "W" }), player_id: "q" },
      ],
    });
    expect(res.ok).toBe(false);
    expect(res.batting[0].h).toBeDefined();
    expect(res.errors).toContain("Only one pitcher can get the win.");
  });

  it("flags duplicates and odd batting orders", () => {
    const res = validateBoxScore({
      batting: [row("a", {}, 1), row("a", {}, 1)],
      pitching: [],
    });
    expect(res.ok).toBe(false);
    expect(res.errors[0]).toMatch(/twice/);
    expect(res.warnings.some((w) => /batting-order/.test(w))).toBe(true);
    expect(validateBoxScore({ batting: [row("a", {}, 31)], pitching: [] }).ok).toBe(false);
  });

  it("matching scores produce no warnings", () => {
    const res = validateBoxScore({
      batting: [row("a", { ab: 4, h: 1, hr: 1, r: 1, rbi: 1 }, 1)],
      pitching: [{ ...pit({ outs: 21, r: 0, decision: "W" }), player_id: "p" }],
      teamScore: 1,
      opponentScore: 0,
    });
    expect(res).toMatchObject({ ok: true, warnings: [], errors: [] });
  });

  it("groups season lines per player", () => {
    const res = seasonByPlayer(
      [
        { ...bat({ ab: 3, h: 1 }), playerId: "a" },
        { ...bat({ ab: 4, h: 2 }), playerId: "a" },
        { ...bat({ ab: 2 }), playerId: "b" },
      ],
      [{ ...pit({ outs: 9, so: 4 }), playerId: "b" }],
    );
    const a = res.find((r) => r.playerId === "a")!;
    const b = res.find((r) => r.playerId === "b")!;
    expect(a.bat).toMatchObject({ g: 2, ab: 7, h: 3 });
    expect(a.pit).toBeNull();
    expect(b.pit).toMatchObject({ app: 1, outs: 9, so: 4 });
  });

  it("warns on HR without R/RBI", () => {
    const res = validateBoxScore({ batting: [row("a", { ab: 1, h: 1, hr: 1 })], pitching: [] });
    expect(res.ok).toBe(true);
    expect(res.warnings).toHaveLength(2);
  });
});
