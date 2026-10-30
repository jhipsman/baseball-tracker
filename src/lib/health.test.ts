import { describe, expect, it } from "vitest";
import { parsePlan, playerHealth, type HealthStatus } from "./health";
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
