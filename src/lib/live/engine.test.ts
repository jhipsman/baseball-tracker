import { describe, expect, it } from "vitest";
import {
  batterUp,
  deriveBox,
  describePlay,
  emptySetup,
  halfLabel,
  outsFor,
  pitchCount,
  pitchSmartLive,
  situation,
  type Play,
  type Result,
} from "./engine";

const A = "a",
  B = "b",
  C = "c",
  P = "p1",
  P2 = "p2";
const setup = emptySetup([A, B, C], P, false); // home team: they bat first

let seq = 0;
function play(weBat: boolean, kind: Play["kind"], extra: Partial<Play> = {}): Play {
  seq += 1;
  const result = (extra.result ?? null) as Result | null;
  return {
    seq,
    inning: 1,
    half: "top",
    weBat,
    kind,
    batterId: null,
    pitcherId: weBat ? null : P,
    slot: null,
    result,
    rbi: 0,
    runs: 0,
    unearned: 0,
    scored: [],
    pitches: 0,
    outs: kind === "pa" || kind === "steal" ? outsFor(result) : 0,
    ...extra,
  };
}

describe("outs", () => {
  it("counts outs by result", () => {
    expect(outsFor("K")).toBe(1);
    expect(outsFor("DP")).toBe(2);
    expect(outsFor("1B")).toBe(0);
    expect(outsFor("BB")).toBe(0);
    expect(outsFor("SF")).toBe(1);
    expect(outsFor(null)).toBe(0);
  });
});

describe("situation", () => {
  it("starts with the right team batting", () => {
    expect(situation(setup, []).weBat).toBe(false);
    expect(situation(emptySetup([A], P, true), []).weBat).toBe(true);
    expect(halfLabel(situation(setup, []))).toBe("Top 1");
  });

  it("flips halves at three outs and advances the inning", () => {
    seq = 0;
    const plays = [
      play(false, "pa", { result: "K", pitches: 4 }),
      play(false, "pa", { result: "1B", pitches: 2 }),
      play(false, "pa", { result: "DP", pitches: 1 }),
    ];
    let s = situation(setup, plays);
    expect(s).toMatchObject({ inning: 1, half: "bottom", weBat: true, outs: 0 });
    expect(batterUp(s)).toBe(A);

    plays.push(
      play(true, "pa", { batterId: A, result: "HR", rbi: 1, runs: 1, scored: [A] }),
      play(true, "pa", { batterId: B, result: "GO" }),
      play(true, "pa", { batterId: C, result: "FO" }),
      play(true, "pa", { batterId: A, result: "K" }),
    );
    s = situation(setup, plays);
    expect(s).toMatchObject({ inning: 2, half: "top", weBat: false, us: 1, them: 0 });
    expect(s.lineScore).toEqual([
      { us: 1, them: 0 },
      { us: 0, them: 0 },
    ]);
    // Lineup wraps: after A, B, C, A the next batter is B.
    expect(s.batterIdx).toBe(1);
  });

  it("closes a half with half_end and applies subs", () => {
    seq = 0;
    const plays = [
      play(false, "pa", { result: "BB", pitches: 5 }),
      play(false, "half_end", { runs: 2 }),
      play(true, "sub", { slot: 2, batterId: "x" }),
      play(true, "sub", { pitcherId: P2 }),
    ];
    const s = situation(setup, plays);
    expect(s).toMatchObject({ half: "bottom", weBat: true, them: 2, pitcherId: P2 });
    expect(s.lineup).toEqual([A, "x", C]);
  });
});

describe("box score", () => {
  it("derives batting and pitching lines", () => {
    seq = 0;
    const plays = [
      play(false, "pa", { result: "K", pitches: 5 }),
      play(false, "pa", { result: "HR", pitches: 3, runs: 1 }),
      play(false, "pa", { result: "E", pitches: 2 }),
      play(false, "pa", { result: "1B", pitches: 1, runs: 1, unearned: 1 }),
      play(false, "pa", { result: "GO", pitches: 2 }),
      play(false, "steal", { result: "CS" }),
      play(true, "pa", { batterId: A, result: "2B" }),
      play(true, "steal", { batterId: A, result: "SB" }),
      play(true, "pa", { batterId: B, result: "SF", rbi: 1, runs: 1, scored: [A] }),
      play(true, "pa", { batterId: C, result: "BB" }),
      play(true, "pa", { batterId: A, result: "KL" }),
      play(true, "pa", { batterId: B, result: "DP" }),
    ];
    const { batting, pitching } = deriveBox(setup, plays, 0);
    const a = batting.find((l) => l.player_id === A)!;
    const b = batting.find((l) => l.player_id === B)!;
    const c = batting.find((l) => l.player_id === C)!;
    expect(a).toMatchObject({ ab: 2, h: 1, doubles: 1, so: 1, sb: 1, r: 1, batting_order: 1 });
    expect(b).toMatchObject({ ab: 1, h: 0, sf: 1, rbi: 1 });
    expect(c).toMatchObject({ ab: 0, bb: 1 });
    expect(pitching).toEqual([
      {
        player_id: P,
        outs: 3,
        h: 2,
        r: 2,
        er: 1,
        bb: 0,
        so: 1,
        hbp: 0,
        hr: 1,
        pitches: 13,
      },
    ]);
  });

  it("credits quick-closed half outs to the pitcher then", () => {
    seq = 0;
    const plays = [
      play(false, "pa", { result: "K", pitches: 3 }),
      play(false, "half_end", { runs: 1 }),
    ];
    const { pitching } = deriveBox(setup, plays, 0);
    expect(pitching[0]).toMatchObject({ outs: 3, r: 1, er: 1, pitches: 3 });
  });

  it("adds the at-bat in progress to the current pitcher", () => {
    seq = 0;
    const plays = [play(false, "pa", { result: "K", pitches: 4 })];
    const live = { ...setup, pitches: 3 };
    expect(pitchCount(live, plays, P)).toBe(7);
    expect(deriveBox(live, plays, 3).pitching[0].pitches).toBe(7);
  });
});

describe("feed text", () => {
  it("describes plays", () => {
    const name = (id: string | null) => (id === A ? "Pete" : "Cal");
    seq = 0;
    expect(
      describePlay(play(true, "pa", { batterId: A, result: "2B", rbi: 2, runs: 2 }), name),
    ).toBe("Pete: double · 2 RBI · 2 runs scored");
    expect(describePlay(play(false, "pa", { result: "KL", pitches: 6 }), name)).toBe(
      "Their batter: strikeout looking (6 pitches)",
    );
    expect(describePlay(play(true, "sub", { slot: 3, batterId: A }), name)).toBe(
      "Lineup: Pete now bats 3rd",
    );
    expect(describePlay(play(false, "sub", { pitcherId: B }), name)).toBe(
      "Pitching change: Cal now pitching",
    );
  });
});

describe("Pitch Smart live", () => {
  const youth = { dailyMax: 85, restThresholds: [20, 35, 50, 65] };
  it("reports rest now and the next threshold", () => {
    expect(pitchSmartLive(47, youth)).toMatchObject({
      left: 38,
      restNow: 2,
      untilMoreRest: 4,
      restAfterNext: 3,
      over: false,
    });
    expect(pitchSmartLive(20, youth)).toMatchObject({ restNow: 0, untilMoreRest: 1 });
    expect(pitchSmartLive(70, youth)).toMatchObject({ restNow: 4, untilMoreRest: null });
    expect(pitchSmartLive(90, youth)?.over).toBe(true);
    expect(pitchSmartLive(10, null)).toBeNull();
  });
});
