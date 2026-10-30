import { describe, expect, it } from "vitest";
import { compactDose, currentWeekIndex, programOverview } from "./program-overview";

const ex = (exerciseId: string, dose: string) => ({
  exerciseId,
  name: exerciseId,
  dose,
  notes: "",
});

describe("programOverview", () => {
  const weeks = [1, 2].map((n) => ({
    number: n,
    label: "",
    days: [
      {
        id: `b${n}`,
        name: "Bullpen",
        items: [ex("Band ER", "2 × 15"), ex("Bullpen", `1 × ${15 + n * 5}`)],
      },
      { id: `f${n}`, name: "Flat ground", items: [ex("Band ER", "2 × 15"), ex("Flat", "1 × 15")] },
      {
        id: `p${n}`,
        name: "Bullpen",
        items: [ex("Band ER", "2 × 15"), ex("Bullpen", `1 × ${20 + n * 5}`)],
      },
    ],
  }));

  it("lists a routine shared by every day once, and keeps each day's own work", () => {
    const { weeks: out } = programOverview(weeks);
    expect(out[0].shared.map((s) => s.exerciseId)).toEqual(["Band ER"]);
    expect(out[0].days[0].items.map((s) => s.exerciseId)).toEqual(["Bullpen"]);
    expect(out[0].days[0].total).toBe(2);
  });

  it("does not treat an exercise as shared when its dose differs", () => {
    const w = [
      {
        number: 1,
        label: "",
        days: [
          { id: "a", name: "A", items: [ex("X", "2 × 10")] },
          { id: "b", name: "B", items: [ex("X", "3 × 10")] },
        ],
      },
    ];
    expect(programOverview(w).weeks[0].shared).toEqual([]);
  });

  it("shows only what changes week to week, naming the day when an exercise repeats", () => {
    const { progression } = programOverview(weeks);
    expect(progression).toEqual([
      { label: "Bullpen · day 1", values: ["20", "25"] },
      { label: "Bullpen · day 3", values: ["25", "30"] },
    ]);
  });

  it("has no shared routine for a one-day week", () => {
    const w = [{ number: 1, label: "", days: [{ id: "a", name: "A", items: [ex("X", "1")] }] }];
    expect(programOverview(w).weeks[0].shared).toEqual([]);
  });
});

describe("compactDose", () => {
  it("drops a single set and tightens the intensity", () => {
    expect(compactDose("1 × 30 pitches · @ 85–90%")).toBe("30 pitches @ 85–90%");
    expect(compactDose("2 × 15")).toBe("2 × 15");
  });
});

describe("currentWeekIndex", () => {
  it("counts weeks from the start date and clamps to the program", () => {
    expect(currentWeekIndex("2026-10-15", "2026-10-30", 4)).toBe(2);
    expect(currentWeekIndex("2026-11-15", "2026-10-30", 4)).toBe(0);
    expect(currentWeekIndex("2026-01-01", "2026-10-30", 4)).toBe(3);
  });
});
