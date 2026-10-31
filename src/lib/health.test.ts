import { describe, expect, it } from "vitest";
import {
  CONCUSSION_PROTOCOL,
  injuryLabel,
  NO_INJURY,
  parsePlan,
  planFor,
  playerHealth,
  RETURN_TO_PLAY,
  RETURN_TO_THROW,
  toHealthStatus,
  type HealthStatus,
} from "./health";
import type { Alert, Availability } from "./workload";

const ready: Availability = {
  state: "available",
  pitchesToday: 0,
  remainingToday: 85,
  dailyMax: 85,
};
const pain: Alert = {
  level: "critical",
  message: "Reported arm pain on Mon",
  key: "pain:2026-11-02",
};
const base = {
  id: "p",
  name: "Pete",
  status: null,
  alerts: [] as Alert[],
  acked: new Set<string>(),
  avail: ready,
  feel: null,
  checkedInToday: false,
  dateLabel: (d: string) => d,
};

describe("playerHealth", () => {
  it("is ready with pitches left when nothing is wrong", () => {
    const h = playerHealth(base);
    expect([h.lane, h.detail]).toEqual(["ready", "Up to 85 pitches today"]);
  });
  it("needs a look while an alert is open, and not once it's handled", () => {
    expect(playerHealth({ ...base, alerts: [pain] }).lane).toBe("attention");
    const h = playerHealth({ ...base, alerts: [pain], acked: new Set([pain.key]) });
    expect([h.lane, h.open.length, h.handled.length]).toEqual(["ready", 0, 1]);
  });
  it("puts the coach's call first", () => {
    const out: HealthStatus = {
      status: "out",
      reason: "Elbow",
      returnDate: "2026-11-20",
      plan: [],
      injury: NO_INJURY,
    };
    const h = playerHealth({ ...base, status: out, alerts: [pain] });
    expect([h.lane, h.detail]).toEqual(["out", "Elbow · back 2026-11-20"]);
  });
  it("shows Pitch Smart rest", () => {
    const h = playerHealth({
      ...base,
      avail: { state: "resting", until: "2026-11-04", daysLeft: 2, dailyMax: 85 },
    });
    expect([h.lane, h.detail]).toEqual(["resting", "Rest until 2026-11-04"]);
  });
  it("ignores info alerts", () => {
    const info: Alert = { level: "info", message: "Add a birthdate", key: "birthdate" };
    expect(playerHealth({ ...base, alerts: [info] }).lane).toBe("ready");
  });
});

describe("parsePlan", () => {
  it("keeps only real steps", () => {
    expect(parsePlan([{ label: " Catch ", done: true }, { label: "" }, 3, null])).toEqual([
      { label: "Catch", done: true },
    ]);
    expect(parsePlan("nope")).toEqual([]);
  });
});

describe("injuries", () => {
  it("labels where and what", () => {
    expect(injuryLabel({ type: "sprain", bodyPart: "ankle", side: "left" })).toBe(
      "Left ankle sprain",
    );
    expect(injuryLabel({ type: "strain", bodyPart: "lower_back", side: null })).toBe(
      "Lower back strain",
    );
    expect(injuryLabel({ type: "other", bodyPart: "elbow", side: "both" })).toBe("Elbow");
    expect(injuryLabel({ type: "soreness", bodyPart: null, side: null })).toBe("Soreness");
    expect(injuryLabel({ type: "concussion", bodyPart: "head", side: null })).toBe(
      "Concussion protocol",
    );
    expect(injuryLabel({ type: null, bodyPart: null, side: null })).toBeNull();
  });
  it("picks the plan for the injury", () => {
    expect(planFor("concussion", null)).toBe(CONCUSSION_PROTOCOL);
    expect(planFor("strain", "shoulder")).toBe(RETURN_TO_THROW);
    expect(planFor("sprain", "ankle")).toBe(RETURN_TO_PLAY);
    expect(planFor("illness", null)).toEqual([]);
  });
  it("puts the injury in the card line and ignores unknown values", () => {
    const status = toHealthStatus({
      status: "limited",
      reason: "No running",
      return_date: null,
      plan: [],
      injury_type: "strain",
      body_part: "hamstring",
      side: "right",
      started_on: "2026-11-01",
      clearance_path: null,
      clearance_at: null,
    });
    expect(playerHealth({ ...base, status }).detail).toBe("Right hamstring strain: No running");
    const odd = toHealthStatus({
      status: "out",
      reason: null,
      return_date: null,
      plan: null,
      injury_type: "broken",
      body_part: "tail",
      side: "up",
      started_on: null,
      clearance_path: null,
      clearance_at: null,
    });
    expect(odd.injury).toEqual(NO_INJURY);
  });
});
