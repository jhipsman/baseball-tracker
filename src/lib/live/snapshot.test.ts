import { describe, expect, it } from "vitest";
import type { LiveSetup, Play } from "./engine";
import { buildSnapshot, pitchChips, tagFor } from "./snapshot";

const play = (p: Partial<Play> & Pick<Play, "seq">): Play => ({
  inning: 1,
  half: "top",
  weBat: true,
  kind: "pa",
  batterId: null,
  pitcherId: null,
  slot: null,
  result: null,
  rbi: 0,
  runs: 0,
  unearned: 0,
  scored: [],
  pitches: 0,
  outs: 0,
  ...p,
});

const setup: LiveSetup = {
  lineup: ["a", "b", "c"],
  pitcherId: "p",
  weBatFirst: true,
  balls: 1,
  strikes: 1,
  pitches: 3,
  pitchHistory: [
    { balls: 1, strikes: 0, pitches: 1 },
    { balls: 1, strikes: 1, pitches: 2 },
    { balls: 1, strikes: 1, pitches: 3 },
  ],
};
const names = new Map([
  ["a", "Carter Hayes"],
  ["b", "Jackson Reed"],
  ["c", "Aiden Murphy"],
  ["p", "Owen Walsh"],
]);

describe("pitchChips", () => {
  it("reads balls, strikes and fouls from the count snapshots", () => {
    expect(pitchChips(setup.pitchHistory).map((c) => `${c.label} ${c.count}`)).toEqual([
      "Ball 1–0",
      "Strike 1–1",
      "Foul 1–1",
    ]);
  });
  it("is empty without history (older games)", () => {
    expect(pitchChips(undefined)).toEqual([]);
  });
});

describe("tagFor", () => {
  it("marks the moments worth celebrating", () => {
    expect(tagFor(play({ seq: 1, result: "HR", runs: 1 }))).toBe("hr");
    expect(tagFor(play({ seq: 2, result: "1B", runs: 1 }))).toBe("run");
    expect(tagFor(play({ seq: 3, result: "2B" }))).toBe("hit");
    expect(tagFor(play({ seq: 4, result: "KL", outs: 1 }))).toBe("k");
    expect(tagFor(play({ seq: 5, result: "BB" }))).toBe("walk");
    expect(tagFor(play({ seq: 6, result: "GO", outs: 1 }))).toBe("out");
    expect(tagFor(play({ seq: 7, kind: "sub", pitcherId: "p" }))).toBeNull();
  });
});

describe("buildSnapshot", () => {
  const plays = [
    play({
      seq: 1,
      batterId: "a",
      result: "2B",
      pitches: 4,
      details: { version: 1, moves: [{ id: "a", from: 0, to: 2 }], location: { x: 0.3, y: 0.3 } },
    }),
    play({
      seq: 2,
      batterId: "b",
      result: "1B",
      runs: 1,
      rbi: 1,
      scored: ["a"],
      details: {
        version: 1,
        moves: [
          { id: "a", from: 2, to: "home" },
          { id: "b", from: 0, to: 1 },
        ],
        location: { x: 0.6, y: 0.35 },
      },
    }),
  ];
  const s = buildSnapshot({ status: "live", teamScore: 1, opponentScore: 0, setup, plays, names });

  it("puts runners on their bases with initials", () => {
    expect(s.bases).toEqual({ 1: { id: "b", initials: "JR", name: "Jackson", ours: true } });
  });
  it("keeps the score, count and who is up", () => {
    expect([s.us, s.them, s.balls, s.strikes, s.outs]).toEqual([1, 0, 1, 1, 0]);
    expect(s.batter).toBe("Aiden Murphy");
    expect(s.atBat).toHaveLength(3);
  });
  it("lists plays newest first, tagged, and every ball in play for the spray chart", () => {
    expect(s.feed.map((f) => f.tag)).toEqual(["run", "hit"]);
    expect(s.feed[0].text).toContain("Jackson");
    expect(s.spray).toEqual([
      { seq: 1, x: 0.3, y: 0.3, hit: true, weBat: true },
      { seq: 2, x: 0.6, y: 0.35, hit: true, weBat: true },
    ]);
    expect(s.lastSeq).toBe(2);
  });
  it("hides opponent identities", () => {
    const opp = buildSnapshot({
      status: "live",
      teamScore: 0,
      opponentScore: 0,
      setup: { ...setup, weBatFirst: false },
      plays: [
        play({
          seq: 1,
          weBat: false,
          pitcherId: "p",
          result: "1B",
          details: { version: 1, moves: [{ id: "opponent:1", from: 0, to: 1 }] },
        }),
      ],
      names,
    });
    expect(opp.bases[1]).toMatchObject({ initials: "OP", name: "Opponent", ours: false });
    expect(opp.batter).toBe("Batter 2");
    expect(opp.feed[0].text).toMatch(/^Batter 1: single/);
    expect(opp.pitcher).toBe("Owen Walsh");
  });
});
