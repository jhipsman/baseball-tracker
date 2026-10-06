import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  dayOfWeek,
  planDates,
  scheduleFor,
  todayIn,
  weekStartOf,
} from "./schedule";

const flexWeek = (prefix: string, n = 3) => ({
  days: Array.from({ length: n }, (_, i) => ({ id: `${prefix}d${i + 1}`, dayOfWeek: null })),
});
// 2026-10-05 is a Monday.
const START = "2026-10-05";

describe("date helpers", () => {
  it("computes day differences and weekdays", () => {
    expect(daysBetween("2026-10-05", "2026-10-12")).toBe(7);
    expect(daysBetween("2026-10-05", "2026-10-04")).toBe(-1);
    expect(dayOfWeek("2026-10-05")).toBe(1);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("formats today in a time zone", () => {
    const lateUtc = new Date("2026-10-06T03:00:00Z");
    expect(todayIn("America/Los_Angeles", lateUtc)).toBe("2026-10-05");
    expect(todayIn("UTC", lateUtc)).toBe("2026-10-06");
    expect(todayIn("Not/AZone", lateUtc)).toBe("2026-10-06");
  });
});

describe("scheduleFor", () => {
  const weeks = [flexWeek("w1"), flexWeek("w2")];

  it("is upcoming before the start date", () => {
    expect(scheduleFor(START, "2026-10-03", weeks, new Set())).toEqual({
      state: "upcoming",
      startsInDays: 2,
    });
  });

  it("is finished after the last week", () => {
    expect(scheduleFor(START, "2026-10-19", weeks, new Set())).toEqual({ state: "finished" });
  });

  it("picks the first unlogged day in flexible weeks", () => {
    const s = scheduleFor(START, "2026-10-07", weeks, new Set(["w1d1"]));
    expect(s).toMatchObject({
      state: "active",
      weekIndex: 0,
      todayDayId: "w1d2",
      weekComplete: false,
    });
  });

  it("moves to week 2 after 7 days", () => {
    const s = scheduleFor(START, "2026-10-12", weeks, new Set(["w1d1"]));
    expect(s).toMatchObject({ state: "active", weekIndex: 1, todayDayId: "w2d1" });
  });

  it("reports a complete week", () => {
    const s = scheduleFor(START, "2026-10-08", weeks, new Set(["w1d1", "w1d2", "w1d3"]));
    expect(s).toMatchObject({ todayDayId: null, weekComplete: true });
  });

  describe("weekday-pinned days", () => {
    // Mon / Wed / Fri
    const pinned = [
      {
        days: [
          { id: "mon", dayOfWeek: 1 },
          { id: "wed", dayOfWeek: 3 },
          { id: "fri", dayOfWeek: 5 },
        ],
      },
    ];

    it("uses the day matching today's weekday", () => {
      expect(scheduleFor(START, "2026-10-07", pinned, new Set(["mon"]))).toMatchObject({
        todayDayId: "wed",
        catchUpDayId: null,
      });
    });

    it("is a rest day when nothing is pinned to today", () => {
      expect(scheduleFor(START, "2026-10-06", pinned, new Set(["mon"]))).toMatchObject({
        todayDayId: null,
        catchUpDayId: null,
      });
    });

    it("offers a missed earlier day as catch-up, but not a future one", () => {
      expect(scheduleFor(START, "2026-10-07", pinned, new Set())).toMatchObject({
        todayDayId: "wed",
        catchUpDayId: "mon",
      });
    });
  });
});

describe("planDates", () => {
  it("spreads flexible days through each week", () => {
    const plan = planDates(START, [flexWeek("w1"), flexWeek("w2")]);
    expect(plan.map((p) => p.date)).toEqual([
      "2026-10-05",
      "2026-10-07",
      "2026-10-09",
      "2026-10-12",
      "2026-10-14",
      "2026-10-16",
    ]);
  });

  it("places weekday-pinned days on their weekday within the program week", () => {
    // Start on a Wednesday; Monday falls 5 days later in the same program week.
    const plan = planDates("2026-10-07", [
      {
        days: [
          { id: "mon", dayOfWeek: 1 },
          { id: "wed", dayOfWeek: 3 },
        ],
      },
    ]);
    expect(plan).toEqual([
      { dayId: "mon", weekIndex: 0, date: "2026-10-12" },
      { dayId: "wed", weekIndex: 0, date: "2026-10-07" },
    ]);
  });

  it("finds the Sunday that starts a week", () => {
    expect(weekStartOf("2026-10-07")).toBe("2026-10-04");
    expect(weekStartOf("2026-10-04")).toBe("2026-10-04");
  });
});
