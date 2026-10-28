import { describe, expect, it } from "vitest";
import {
  bestTime,
  effectiveTracking,
  formatSeconds,
  formatSets,
  parseDistance,
  trimNumber,
} from "./sets-format";

const s = (o: Record<string, unknown>) => ({
  set: 1,
  reps: null,
  weight: null,
  rpe: null,
  done: true,
  ...o,
});

describe("formatSeconds / trimNumber", () => {
  it("formats short and long durations", () => {
    expect(trimNumber(7.1)).toBe("7.1");
    expect(trimNumber(7.125)).toBe("7.13");
    expect(formatSeconds(7.12)).toBe("7.12 s");
    expect(formatSeconds(30)).toBe("30 s");
    expect(formatSeconds(105)).toBe("1:45");
    expect(formatSeconds(65.3)).toBe("1:05.3");
  });
});

describe("parseDistance", () => {
  it("reads common units", () => {
    expect(parseDistance("60 yd")).toEqual({ value: 60, unit: "yd" });
    expect(parseDistance("4x100m")).toEqual({ value: 100, unit: "m" });
    expect(parseDistance("90 feet")).toEqual({ value: 90, unit: "ft" });
    expect(parseDistance("40 yards")).toEqual({ value: 40, unit: "yd" });
    expect(parseDistance("8-10")).toBeNull();
  });
});

describe("formatSets", () => {
  it("weight × reps with one weight", () => {
    const sets = [
      s({ reps: 5, weight: 185 }),
      s({ reps: 5, weight: 185 }),
      s({ reps: 4, weight: 185 }),
    ];
    expect(formatSets(sets, "weight_reps")).toBe("185 lb × 5, 5, 4");
  });

  it("weight × reps with changing weights (legacy logs)", () => {
    const sets = [s({ reps: 8, weight: 135 }), s({ reps: 6, weight: 155 })];
    expect(formatSets(sets)).toBe("135×8, 155×6");
  });

  it("falls back to reps when no weight was logged", () => {
    expect(formatSets([s({ reps: 10 }), s({ reps: 10 }), s({ reps: 10 })], "weight_reps")).toBe(
      "3 × 10",
    );
  });

  it("reps only", () => {
    expect(formatSets([s({ reps: 10 }), s({ reps: 10 }), s({ reps: 10 })], "reps")).toBe("3 × 10");
    expect(formatSets([s({ reps: 10 }), s({ reps: 8 })], "reps")).toBe("10, 8");
  });

  it("time shows average and best (lower is better)", () => {
    const sets = [s({ time_s: 7.3 }), s({ time_s: 7.1 }), s({ time_s: 6.9 })];
    expect(formatSets(sets, "time")).toBe("3 × 7.1 s (best 6.9 s)");
    expect(formatSets([s({ time_s: 7.12 })], "time")).toBe("7.12 s");
    expect(formatSets([s({ time_s: 30 }), s({ time_s: 30 })], "time")).toBe("2 × 30 s");
  });

  it("distance", () => {
    const same = [
      s({ distance: 40, distance_unit: "yd" }),
      s({ distance: 40, distance_unit: "yd" }),
    ];
    expect(formatSets(same, "distance")).toBe("2 × 40 yd");
    const diff = [
      s({ distance: 200, distance_unit: "ft" }),
      s({ distance: 240, distance_unit: "ft" }),
    ];
    expect(formatSets(diff, "distance")).toBe("200, 240 ft (best 240 ft)");
    const mixed = [
      s({ distance: 40, distance_unit: "yd" }),
      s({ distance: 30, distance_unit: "m" }),
    ];
    expect(formatSets(mixed, "distance")).toBe("40 yd, 30 m");
  });

  it("distance + time", () => {
    expect(
      formatSets([s({ distance: 500, distance_unit: "m", time_s: 105 })], "distance_time"),
    ).toBe("500 m in 1:45");
    const sprints = [
      s({ distance: 60, distance_unit: "yd", time_s: 7.3 }),
      s({ distance: 60, distance_unit: "yd", time_s: 6.9 }),
      s({ distance: 60, distance_unit: "yd", time_s: 7.1 }),
    ];
    expect(formatSets(sprints, "distance_time")).toBe("3 × 60 yd in 7.1 s (best 6.9 s)");
    expect(
      formatSets([s({ distance: 40, distance_unit: "yd" }), s({ time_s: 9 })], "distance_time"),
    ).toBe("40 yd, 9 s");
  });

  it("skips empty sets and handles junk input", () => {
    expect(formatSets([s({}), s({ reps: "" })], "reps")).toBe("");
    expect(formatSets(null)).toBe("");
    expect(formatSets("nope")).toBe("");
    expect(formatSets([null, 3, s({ reps: 5 })], "reps")).toBe("1 × 5");
  });

  it("adds RPE range and not-done count when asked", () => {
    const sets = [
      s({ reps: 5, weight: 185, rpe: 7 }),
      s({ reps: 5, weight: 185, rpe: 8, done: false }),
    ];
    expect(formatSets(sets, "weight_reps", { rpe: true, notDone: true })).toBe(
      "185 lb × 5, 5 @ RPE 7–8 (1 not done)",
    );
  });

  it("uses the data actually logged when the exercise type changed later", () => {
    const old = [s({ reps: 8, weight: 100 })];
    expect(formatSets(old, "time")).toBe("100 lb × 8");
    expect(effectiveTracking([s({ time_s: 7 })], "weight_reps")).toBe("time");
    expect(effectiveTracking([s({ time_s: 7, distance: 60 })], "reps")).toBe("distance_time");
  });
});

describe("bestTime", () => {
  it("returns the fastest time", () => {
    expect(bestTime([s({ time_s: 7.3 }), s({ time_s: 6.95 }), s({})])).toBe(6.95);
    expect(bestTime([s({ reps: 5 })])).toBeNull();
    expect(bestTime(undefined)).toBeNull();
  });
});
