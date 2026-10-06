import { describe, expect, it } from "vitest";
import {
  acuteChronic,
  ageOn,
  availability,
  pitchSmartBand,
  requiredRestDays,
  throwingAlerts,
  type ThrowLog,
} from "./workload";
import { addDays } from "./schedule";

const TODAY = "2026-10-10";
const log = (
  date: string,
  type: ThrowLog["type"],
  pitches: number,
  armFeel: ThrowLog["armFeel"] = null,
): ThrowLog => ({
  date,
  type,
  pitches,
  armFeel,
});

describe("Pitch Smart", () => {
  it("uses the right band per age", () => {
    expect(pitchSmartBand(8).dailyMax).toBe(50);
    expect(pitchSmartBand(12).dailyMax).toBe(85);
    expect(pitchSmartBand(16).dailyMax).toBe(95);
    expect(pitchSmartBand(18).dailyMax).toBe(105);
    expect(pitchSmartBand(21).dailyMax).toBe(120);
  });

  it("computes required rest days", () => {
    // 13–14: 1-20 → 0, 21-35 → 1, 36-50 → 2, 51-65 → 3, 66+ → 4
    expect([20, 21, 35, 36, 50, 51, 65, 66].map((p) => requiredRestDays(13, p))).toEqual([
      0, 1, 1, 2, 2, 3, 3, 4,
    ]);
    // 17–18: 1-30 → 0, 31-45 → 1, 46-60 → 2, 61-75 → 3, 76+ → 4
    expect([30, 31, 45, 46, 60, 61, 75, 76].map((p) => requiredRestDays(17, p))).toEqual([
      0, 1, 1, 2, 2, 3, 3, 4,
    ]);
    expect(requiredRestDays(17, 0)).toBe(0);
  });

  it("computes age on a date", () => {
    expect(ageOn("2009-10-11", "2026-10-10")).toBe(16);
    expect(ageOn("2009-10-10", "2026-10-10")).toBe(17);
  });
});

describe("availability", () => {
  const born = "2009-01-01"; // 17

  it("needs a birthdate", () => {
    expect(availability([], null, TODAY)).toEqual({ state: "unknown_age" });
  });

  it("rests after a big outing", () => {
    // 80 pitches 2 days ago → 4 rest days → available 5 days after.
    const a = availability([log(addDays(TODAY, -2), "game", 80)], born, TODAY);
    expect(a).toEqual({ state: "resting", until: addDays(TODAY, 3), daysLeft: 3, dailyMax: 105 });
  });

  it("is available once rest is done, and counts today's pitches", () => {
    const a = availability(
      [log(addDays(TODAY, -5), "game", 80), log(TODAY, "live_abs", 25)],
      born,
      TODAY,
    );
    expect(a).toEqual({ state: "available", pitchesToday: 25, remainingToday: 80, dailyMax: 105 });
  });

  it("ignores bullpens and throwing sessions for Pitch Smart rest", () => {
    const a = availability([log(addDays(TODAY, -1), "bullpen", 60)], born, TODAY);
    expect(a.state).toBe("available");
  });
});

describe("acute:chronic", () => {
  it("needs three weeks of history", () => {
    expect(acuteChronic([log(addDays(TODAY, -10), "long_toss", 100)], TODAY)).toBeNull();
  });

  it("compares this week to the 4-week average", () => {
    const logs = [
      log(addDays(TODAY, -25), "long_toss", 100),
      log(addDays(TODAY, -18), "long_toss", 100),
      log(addDays(TODAY, -11), "long_toss", 100),
      log(addDays(TODAY, -2), "long_toss", 300),
    ];
    const r = acuteChronic(logs, TODAY)!;
    expect(r.acute).toBe(300);
    expect(r.chronic).toBe(150);
    expect(r.ratio).toBe(2);
  });
});

describe("alerts", () => {
  const born = "2012-06-01"; // 14 in Oct 2026 → max 95, youth rest table

  it("flags arm pain first", () => {
    const a = throwingAlerts([log(addDays(TODAY, -1), "check_in", 0, "pain")], born, TODAY);
    expect(a[0]).toMatchObject({ level: "critical", message: expect.stringContaining("arm pain") });
  });

  it("flags over-max outings and pitching without rest", () => {
    const a = throwingAlerts(
      [log(addDays(TODAY, -3), "game", 100), log(addDays(TODAY, -1), "game", 30)],
      born,
      TODAY,
    );
    const msgs = a.map((x) => x.message).join(" | ");
    expect(msgs).toContain("over the Pitch Smart daily max of 95 for age 14");
    expect(msgs).toContain("before the required rest after 100 pitches");
  });

  it("asks for a birthdate when there are competitive pitches", () => {
    const a = throwingAlerts([log(TODAY, "game", 40)], null, TODAY);
    expect(a).toEqual([{ level: "info", message: "Add a birthdate to check Pitch Smart limits" }]);
  });

  it("flags repeated soreness and volume spikes", () => {
    const logs = [
      log(addDays(TODAY, -25), "long_toss", 50),
      log(addDays(TODAY, -18), "long_toss", 50),
      log(addDays(TODAY, -11), "long_toss", 50),
      log(addDays(TODAY, -3), "bullpen", 120, "sore"),
      log(addDays(TODAY, -1), "long_toss", 100, "sore"),
    ];
    const msgs = throwingAlerts(logs, born, TODAY).map((x) => `${x.level}: ${x.message}`);
    expect(msgs.some((m) => m.startsWith("warning: Sore or painful arm 2×"))).toBe(true);
    expect(msgs.some((m) => m.includes("Throwing volume spike"))).toBe(true);
  });
});
