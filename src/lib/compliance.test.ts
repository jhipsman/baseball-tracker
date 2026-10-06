import { describe, expect, it } from "vitest";
import type { CalendarEntry, EntryStatus } from "./calendar";
import { complianceByPlayer, complianceOf, needsAttention } from "./compliance";

const e = (playerId: string, status: EntryStatus): CalendarEntry => ({
  key: Math.random().toString(),
  date: "2026-10-06",
  playerId,
  assignmentId: "a",
  programId: "p",
  programName: "P",
  dayName: "D",
  sessionType: null,
  status,
});

describe("compliance", () => {
  it("counts logged vs due, ignoring today and upcoming", () => {
    const c = complianceOf([
      e("p1", "completed"),
      e("p1", "partial"),
      e("p1", "missed"),
      e("p1", "skipped"),
      e("p1", "today"),
      e("p1", "upcoming"),
    ]);
    expect(c).toEqual({ due: 4, logged: 2, missed: 1, skipped: 1, rate: 0.5 });
  });

  it("has no rate when nothing was due", () => {
    expect(complianceOf([e("p1", "upcoming")]).rate).toBeNull();
  });

  it("groups by player and flags who needs attention", () => {
    const m = complianceByPlayer([
      e("good", "completed"),
      e("good", "completed"),
      e("bad", "missed"),
      e("bad", "missed"),
      e("bad", "completed"),
    ]);
    expect(needsAttention(m.get("good"))).toBe(false);
    expect(needsAttention(m.get("bad"))).toBe(true);
    expect(needsAttention(undefined)).toBe(false);
  });
});
