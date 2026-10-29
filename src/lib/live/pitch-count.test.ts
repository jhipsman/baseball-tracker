import { describe, expect, it } from "vitest";
import { emptySetup, type LiveSetup } from "./engine";
import { parsePitchHistory, updatePitchCount, type PitchKind } from "./pitch-count";

const setup = (extra: Partial<LiveSetup> = {}) => ({ ...emptySetup(["a"], "p", false), ...extra });
const apply = (live: LiveSetup, kind: PitchKind) => {
  const result = updatePitchCount(live, kind);
  if ("error" in result) throw new Error(result.error);
  return result;
};

describe("pitch-by-pitch count", () => {
  it("keeps an ordinary foul alive at two strikes, but retires on a foul bunt or tip", () => {
    const live = setup({ balls: 1, strikes: 2, pitches: 5 });
    expect(apply(live, "foul")).toMatchObject({ live: { balls: 1, strikes: 2, pitches: 6 } });
    expect(apply(live, "foul").auto).toBeUndefined();
    expect(apply(live, "foul_bunt")).toMatchObject({ auto: "K", live: { pitches: 6 } });
    expect(apply(live, "foul_tip")).toMatchObject({ auto: "K", live: { pitches: 6 } });
    expect(live.pitches).toBe(5);
  });

  it.each(["foul_bunt", "foul_tip"] as const)("counts %s below two strikes", (kind) => {
    expect(apply(setup({ strikes: 1, pitches: 2 }), kind)).toMatchObject({
      live: { strikes: 2, pitches: 3 },
    });
  });

  it("completes walks and distinguishes looking from swinging strikeouts", () => {
    expect(apply(setup({ balls: 3, pitches: 5 }), "ball")).toMatchObject({
      auto: "BB",
      live: { pitches: 6 },
    });
    expect(apply(setup({ strikes: 2 }), "called").auto).toBe("KL");
    expect(apply(setup({ strikes: 2 }), "swinging").auto).toBe("K");
  });

  it("counts contact without completing the at-bat or changing its count", () => {
    const result = apply(setup({ balls: 2, strikes: 1, pitches: 4 }), "in_play");
    expect(result).toMatchObject({ live: { balls: 2, strikes: 1, pitches: 5 } });
    expect(result.auto).toBeUndefined();
  });

  it("undoes both the pitch and its count, including after serializing state", () => {
    let live = apply(setup(), "ball").live;
    live = apply(live, "called").live;
    live = JSON.parse(JSON.stringify(live));
    live = apply(live, "minus").live;
    expect(live).toMatchObject({ balls: 1, strikes: 0, pitches: 1 });
    live = apply(live, "minus").live;
    expect(live).toMatchObject({ balls: 0, strikes: 0, pitches: 0, pitchHistory: [] });
  });

  it("resets the count without erasing workload or reviving old undo snapshots", () => {
    const counted = apply(setup({ pitches: 3 }), "ball").live;
    const reset = apply(counted, "reset").live;
    expect(reset).toMatchObject({ balls: 0, strikes: 0, pitches: 4, pitchHistory: [] });
    expect(apply(reset, "minus").live).toMatchObject({ balls: 0, strikes: 0, pitches: 3 });
    expect(counted.balls).toBe(1);
  });

  it("supports old games without count history and never makes pitches negative", () => {
    expect(apply(setup({ balls: 2, strikes: 1, pitches: 4 }), "minus").live).toMatchObject({
      balls: 2,
      strikes: 1,
      pitches: 3,
    });
    expect(apply(setup(), "minus").live.pitches).toBe(0);
  });

  it("rejects an unknown input rather than silently counting it as a pitch", () => {
    expect(updatePitchCount(setup(), "not-a-pitch")).toEqual({ error: "Choose a pitch result." });
  });

  it("reports the existing per-at-bat storage limit instead of silently dropping a pitch", () => {
    expect(updatePitchCount(setup({ pitches: 40 }), "ball")).toHaveProperty("error");
    expect(apply(setup({ pitches: 40 }), "minus").live.pitches).toBe(39);
    expect(apply(setup({ pitches: 40 }), "reset").live.pitches).toBe(40);
  });

  it("discards malformed persisted undo data", () => {
    expect(
      parsePitchHistory([
        null,
        {},
        { balls: 4, strikes: 1, pitches: 2 },
        { balls: 1, strikes: 1, pitches: 2 },
        { balls: "1", strikes: 1, pitches: 2 },
      ]),
    ).toEqual([{ balls: 1, strikes: 1, pitches: 2 }]);
    expect(parsePitchHistory(null)).toEqual([]);
  });
});
