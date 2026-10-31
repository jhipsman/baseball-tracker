import { describe, expect, it } from "vitest";
import { growthRate, loadAlerts, trainingLoad, type Session } from "./load";
import { addDays } from "./schedule";

const T = "2026-11-12"; // Thursday
const s = (daysAgo: number, minutes: number, rpe: number): Session => ({
  date: addDays(T, -daysAgo),
  minutes,
  rpe,
  source: "team",
});
const base = { sessions: [], heights: [], pitchedDays: [], caughtDays: [], today: T };

describe("load and growth", () => {
  it("needs 3 weeks of history before calling a spike", () => {
    expect(trainingLoad([s(0, 90, 8)], T).ratio).toBeNull();
    const steady = [7, 10, 14, 17, 21, 24, 28, 31].map((d) => s(d, 60, 5)); // 600/week
    const load = trainingLoad([...steady, s(0, 120, 9), s(2, 120, 8), s(4, 90, 7)], T);
    expect(load.chronic).toBe(600);
    expect(load.ratio).toBeCloseTo((1080 + 960 + 630) / 600);
  });
  it("flags a load spike once per week", () => {
    const steady = [7, 10, 14, 17, 21, 24, 28, 31].map((d) => s(d, 60, 5));
    const a = loadAlerts({
      ...base,
      sessions: [...steady, s(0, 120, 9), s(2, 120, 8), s(4, 90, 7)],
    });
    expect(a.map((x) => x.key)).toEqual(["load:2026-11-09"]);
    expect(a[0].level).toBe("critical");
  });
  it("spots a growth spurt from heights 2–7 months apart", () => {
    const heights = [
      { date: "2026-11-01", inches: 64.5 },
      { date: "2026-10-01", inches: 64 },
      { date: "2026-08-01", inches: 63.5 },
    ];
    const g = growthRate(heights)!;
    expect(g.months).toBe(3);
    expect(g.perYear).toBeCloseTo((1 / 92) * 365, 1);
    expect(loadAlerts({ ...base, heights }).map((x) => x.key)).toEqual(["growth:2026-11-01"]);
    expect(
      growthRate([
        { date: "2026-11-01", inches: 64 },
        { date: "2026-10-15", inches: 63 },
      ]),
    ).toBeNull();
  });
  it("flags pitching and catching on the same day this week", () => {
    const a = loadAlerts({
      ...base,
      pitchedDays: ["2026-11-10", "2026-10-01"],
      caughtDays: ["2026-11-10", "2026-10-01"],
    });
    expect(a.map((x) => x.key)).toEqual(["catchpitch:2026-11-10"]);
    expect(
      loadAlerts({ ...base, pitchedDays: ["2026-11-10"], caughtDays: ["2026-11-11"] }),
    ).toEqual([]);
  });
});
