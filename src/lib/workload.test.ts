import { describe, expect, it } from "vitest";
import {
  acuteChronic,
  ageOn,
  availability,
  pitchSmartBand,
  requiredRestDays,
  throwingAlerts,
  computeThrowingPrescription,
  detectThrowingType,
  extractMaxDistance,
  parseWholeNumberReps,
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
    expect(a).toEqual([
      { level: "info", message: "Add a birthdate to check Pitch Smart limits", key: "birthdate" },
    ]);
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
    // Keys stay put for the same occurrence so "handled" sticks.
    expect(throwingAlerts(logs, born, TODAY).map((x) => x.key)).toContain("sore:" + addDays(TODAY, -1));
  });
});


describe("throwing prescription helpers", () => {
  it("parses whole number reps and throws/pitches suffixes", () => {
    expect(parseWholeNumberReps("15")).toBe(15);
    expect(parseWholeNumberReps(" 20 ")).toBe(20);
    expect(parseWholeNumberReps("20 throws")).toBe(20);
    expect(parseWholeNumberReps("25 Throws")).toBe(25);
    expect(parseWholeNumberReps("30 pitches")).toBe(30);
    expect(parseWholeNumberReps("15 Pitches")).toBe(15);

    // Non-whole-numbers and ranges
    expect(parseWholeNumberReps("8-10")).toBeNull();
    expect(parseWholeNumberReps("10-12")).toBeNull();
    expect(parseWholeNumberReps("10.5")).toBeNull();
    expect(parseWholeNumberReps("10 min")).toBeNull();
    expect(parseWholeNumberReps("30s")).toBeNull();
    expect(parseWholeNumberReps("AMRAP")).toBeNull();
    expect(parseWholeNumberReps("to fatigue")).toBeNull();
    expect(parseWholeNumberReps("")).toBeNull();
    expect(parseWholeNumberReps(null)).toBeNull();
    expect(parseWholeNumberReps(undefined)).toBeNull();
  });

  it("extracts largest distance in ft from intensity and notes", () => {
    expect(extractMaxDistance(["180 ft"])).toBe(180);
    expect(extractMaxDistance(["180ft"])).toBe(180);
    expect(extractMaxDistance(["200+ ft"])).toBe(200);
    expect(extractMaxDistance(["70% · 120 ft", "Arc out to 250 ft on last 5"])).toBe(250);
    expect(extractMaxDistance(["120 ft", "90 ft", "60 ft"])).toBe(120);
    expect(extractMaxDistance(["85%", "fastball only", null, undefined])).toBeNull();
    expect(extractMaxDistance([])).toBeNull();
  });

  it("detects throwing type based on exercise name", () => {
    // Default long_toss
    expect(detectThrowingType([{ name: "Long Toss", category: "throwing" }])).toBe("long_toss");
    expect(detectThrowingType([{ name: "Catch Play Progression", category: "throwing" }])).toBe("long_toss");

    // Bullpen keywords: "bullpen" or "pen"
    expect(detectThrowingType([{ name: "Bullpen Session", category: "throwing" }])).toBe("bullpen");
    expect(detectThrowingType([{ name: "bullpen 25 pitches", category: "throwing" }])).toBe("bullpen");
    expect(detectThrowingType([{ name: "Fastball Pen", category: "throwing" }])).toBe("bullpen");
    expect(detectThrowingType([{ name: "Touch-and-feel pen", category: "throwing" }])).toBe("bullpen");
    expect(detectThrowingType([{ name: "Bullpens", category: "throwing" }])).toBe("bullpen");
    expect(detectThrowingType([{ name: "Pen Work", category: "throwing" }])).toBe("bullpen");

    // "pen" inside non-pen words should not trigger bullpen
    expect(detectThrowingType([{ name: "Open Arm Throw", category: "throwing" }])).toBe("long_toss");
    expect(detectThrowingType([{ name: "Pendulum Throws", category: "throwing" }])).toBe("long_toss");

    // Bullpen exercise with non-throwing category should not trigger bullpen type
    expect(detectThrowingType([{ name: "Bullpen Prep Bands", category: "arm_care" }])).toBe("long_toss");
  });
});

describe("computeThrowingPrescription", () => {
  it("prefills a standard long toss day", () => {
    const rx = computeThrowingPrescription({
      programName: "Long Toss Build-up (6 weeks)",
      dayName: "Long Toss",
      exercises: [
        { name: "Band External Rotation", category: "arm_care", sets: 2, reps: "15" },
        { name: "Catch Play Progression", category: "throwing", sets: 1, reps: "10 min" },
        {
          name: "Long Toss",
          category: "throwing",
          sets: 1,
          reps: "20 throws",
          intensity: "180 ft",
          notes: "Arc out to distance, then pull down on a line.",
        },
      ],
    });

    expect(rx).toEqual({
      type: "long_toss",
      pitches: 20,
      maxDistance: 180,
      notes: "Long Toss Build-up (6 weeks) · Long Toss",
    });
  });

  it("prefills a bullpen day with multiple throwing exercises", () => {
    const rx = computeThrowingPrescription({
      programName: "Bullpen Progression (4 weeks)",
      dayName: "Bullpen",
      exercises: [
        { name: "Jaeger Band Arm Care", category: "arm_care", sets: 1, reps: "10" },
        { name: "Long Toss Warmup", category: "throwing", sets: 1, reps: "15 throws", intensity: "120 ft" },
        { name: "Bullpen Session", category: "throwing", sets: 1, reps: "25 pitches", intensity: "80%" },
      ],
    });

    expect(rx).toEqual({
      type: "bullpen",
      pitches: 40, // 15 + 25
      maxDistance: 120,
      notes: "Bullpen Progression (4 weeks) · Bullpen",
    });
  });

  it("handles sets multiplier and picks the largest distance", () => {
    const rx = computeThrowingPrescription({
      programName: "Offseason Velocity",
      dayName: "Mound Pen",
      exercises: [
        { name: "Fastball Pen", category: "throwing", sets: 3, reps: "10", intensity: "60 ft" },
        { name: "Distance Throwing", category: "throwing", sets: 2, reps: "5", notes: "stretch to 240 ft" },
      ],
    });

    expect(rx.type).toBe("bullpen");
    expect(rx.pitches).toBe(40); // (3*10) + (2*5)
    expect(rx.maxDistance).toBe(240);
    expect(rx.notes).toBe("Offseason Velocity · Mound Pen");
  });

  it("leaves pitches and maxDistance undefined when no valid values exist", () => {
    const rx = computeThrowingPrescription({
      programName: "Arm Care Routine",
      dayNumber: 2,
      exercises: [
        { name: "Band Pull-Apart", category: "arm_care", sets: 2, reps: "15" },
        { name: "Catch Play Progression", category: "throwing", sets: 1, reps: "10 min", intensity: "Easy" },
      ],
    });

    expect(rx.type).toBe("long_toss");
    expect(rx.pitches).toBeUndefined();
    expect(rx.maxDistance).toBeUndefined();
    expect(rx.notes).toBe("Arm Care Routine · Day 2");
  });

  it("handles empty exercises and missing names gracefully", () => {
    const rx = computeThrowingPrescription({
      dayNumber: 3,
      exercises: [],
    });

    expect(rx).toEqual({
      type: "long_toss",
      pitches: undefined,
      maxDistance: undefined,
      notes: "Day 3",
    });
  });
});
