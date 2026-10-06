import { describe, expect, it } from "vitest";
import { buildEntries, type CalendarAssignment } from "./calendar";

// 2026-10-05 is a Monday; flexible 3-day weeks land Mon/Wed/Fri.
const assignment = (status: CalendarAssignment["status"] = "active"): CalendarAssignment => ({
  id: "a1",
  playerId: "p1",
  status,
  startDate: "2026-10-05",
  programId: "prog",
  programName: "Fall Strength",
  weeks: [
    {
      days: [
        { id: "d1", dayOfWeek: null, name: "Lower", sessionType: "strength" },
        { id: "d2", dayOfWeek: null, name: "Upper", sessionType: "strength" },
        { id: "d3", dayOfWeek: null, name: "Speed", sessionType: "conditioning" },
      ],
    },
  ],
});

describe("buildEntries", () => {
  it("marks planned days as missed / today / upcoming and shows logs on their logged date", () => {
    const entries = buildEntries(
      [assignment()],
      [
        {
          assignmentId: "a1",
          dayId: "d1",
          dayName: "Lower",
          status: "completed",
          date: "2026-10-06",
        },
      ],
      "2026-10-04",
      "2026-10-10",
      "2026-10-07",
    );
    expect(entries.map((e) => [e.date, e.dayName, e.status])).toEqual([
      ["2026-10-06", "Lower", "completed"], // logged a day late
      ["2026-10-07", "Upper", "today"],
      ["2026-10-09", "Speed", "upcoming"],
    ]);
  });

  it("flags past unlogged days as missed", () => {
    const entries = buildEntries([assignment()], [], "2026-10-04", "2026-10-10", "2026-10-08");
    expect(entries.map((e) => e.status)).toEqual(["missed", "missed", "upcoming"]);
  });

  it("only shows logs (no plan) for paused or completed assignments", () => {
    const entries = buildEntries(
      [assignment("paused")],
      [
        {
          assignmentId: "a1",
          dayId: "d2",
          dayName: "Upper",
          status: "partial",
          date: "2026-10-07",
        },
      ],
      "2026-10-04",
      "2026-10-10",
      "2026-10-08",
    );
    expect(entries.map((e) => [e.dayName, e.status])).toEqual([["Upper", "partial"]]);
  });

  it("clips to the date range and keeps logs for deleted days", () => {
    const entries = buildEntries(
      [assignment()],
      [
        {
          assignmentId: "a1",
          dayId: null,
          dayName: "Old Day",
          status: "skipped",
          date: "2026-10-05",
        },
      ],
      "2026-10-05",
      "2026-10-06",
      "2026-10-05",
    );
    expect(entries.map((e) => [e.dayName, e.status])).toEqual([
      ["Lower", "today"],
      ["Old Day", "skipped"],
    ]);
  });
});
