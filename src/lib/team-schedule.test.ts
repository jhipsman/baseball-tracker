import { describe, it, expect } from "vitest";
import {
  previewScheduleChange,
  readScheduleChange,
  readEvent,
  scheduleConflicts,
  type Activity,
  type ScheduleChange,
} from "./team-schedule";
const id = "10000000-0000-4000-8000-000000000001";
const activity: Activity = {
  id,
  org_id: id,
  kind: "event",
  group_id: null,
  title: "Practice",
  date: "2026-10-31",
  start_time: "23:30:00",
  duration_minutes: 120,
  location: "Field 1",
  published: true,
  state: "scheduled",
  updated_at: "2026-10-30T12:00:00Z",
  series_id: null,
};
const change: ScheduleChange = {
  items: [{ id, kind: "event", updatedAt: activity.updated_at }],
  action: "reschedule",
  days: 1,
  time: null,
  location: null,
  notify: true,
};
describe("organizer schedule rules", () => {
  it("previews date shifts without modifying the source or dropping local times", () => {
    const next = previewScheduleChange([activity], change);
    expect(next[0]).toMatchObject({ date: "2026-11-01", start_time: "23:30:00" });
    expect(activity.date).toBe("2026-10-31");
  });
  it("detects an overnight location conflict and ignores canceled or adjacent events", () => {
    const next = {
      ...activity,
      id: "second",
      date: "2026-11-01",
      start_time: "00:30:00",
      location: " field 1 ",
    };
    expect(scheduleConflicts([activity, next])).toHaveLength(1);
    expect(scheduleConflicts([activity, { ...next, start_time: "01:30:00" }])).toHaveLength(0);
    expect(scheduleConflicts([activity, { ...next, state: "canceled" }])).toHaveLength(0);
    expect(scheduleConflicts([activity, { ...next, published: false }])).toHaveLength(0);
  });
  it("requires a bounded valid selection and a last-seen version", () => {
    expect(readScheduleChange(change)).toEqual(change);
    expect(
      readScheduleChange({ ...change, items: [...change.items, ...change.items] }),
    ).toHaveProperty("error");
    expect(readScheduleChange({ ...change, days: 366 })).toHaveProperty("error");
    expect(
      readScheduleChange({ ...change, items: [{ id, kind: "event", updatedAt: "invalid" }] }),
    ).toHaveProperty("error");
    expect(readScheduleChange({ ...change, notify: "yes" })).toHaveProperty("error");
  });
  it("validates event dates, recurring count and duration before any database writes", () => {
    const fd = new FormData();
    Object.entries({
      title: "Team meeting",
      date: "2026-11-01",
      start_time: "17:30",
      duration_minutes: "60",
      count: "3",
      published: "on",
      notify: "on",
    }).forEach(([k, v]) => fd.set(k, v));
    expect(readEvent(fd)).toMatchObject({
      count: 3,
      notify: true,
      event: { date: "2026-11-01", start_time: "17:30", published: true },
    });
    fd.set("date", "2026-02-30");
    expect(readEvent(fd)).toHaveProperty("error");
    fd.set("date", "2026-11-01");
    fd.set("count", "27");
    expect(readEvent(fd)).toHaveProperty("error");
  });
});
