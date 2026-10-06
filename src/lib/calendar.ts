import { planDates, type ScheduleWeek } from "./schedule";

export type EntryStatus = "completed" | "partial" | "skipped" | "missed" | "today" | "upcoming";

export type CalendarAssignment = {
  id: string;
  playerId: string;
  status: "active" | "paused" | "completed";
  startDate: string;
  programId: string;
  programName: string;
  weeks: (ScheduleWeek & {
    days: { id: string; dayOfWeek: number | null; name: string; sessionType: string }[];
  })[];
};

export type CalendarLog = {
  assignmentId: string;
  dayId: string | null;
  dayName: string | null;
  status: "completed" | "partial" | "skipped";
  date: string;
};

export type CalendarEntry = {
  key: string;
  date: string;
  playerId: string;
  assignmentId: string;
  programId: string;
  programName: string;
  dayName: string;
  sessionType: string | null;
  status: EntryStatus;
};

/**
 * Every workout on the calendar between `from` and `to` (inclusive):
 * logged workouts on the day they were logged, and, for active assignments,
 * planned-but-unlogged days on their planned date (missed if in the past).
 */
export function buildEntries(
  assignments: CalendarAssignment[],
  logs: CalendarLog[],
  from: string,
  to: string,
  today: string,
): CalendarEntry[] {
  const entries: CalendarEntry[] = [];
  const inRange = (d: string) => d >= from && d <= to;
  const logsByAssignment = new Map<string, CalendarLog[]>();
  for (const l of logs) {
    const list = logsByAssignment.get(l.assignmentId) ?? [];
    list.push(l);
    logsByAssignment.set(l.assignmentId, list);
  }

  for (const a of assignments) {
    const dayInfo = new Map(a.weeks.flatMap((w) => w.days).map((d) => [d.id, d]));
    const aLogs = logsByAssignment.get(a.id) ?? [];
    const loggedDays = new Set(aLogs.map((l) => l.dayId).filter(Boolean));
    const base = {
      playerId: a.playerId,
      assignmentId: a.id,
      programId: a.programId,
      programName: a.programName,
    };

    for (const l of aLogs) {
      if (!inRange(l.date)) continue;
      const d = l.dayId ? dayInfo.get(l.dayId) : undefined;
      entries.push({
        ...base,
        key: `log-${a.id}-${l.dayId ?? l.date}`,
        date: l.date,
        dayName: d?.name || l.dayName || "Workout",
        sessionType: d?.sessionType ?? null,
        status: l.status,
      });
    }

    if (a.status !== "active") continue;
    for (const p of planDates(a.startDate, a.weeks)) {
      if (loggedDays.has(p.dayId) || !inRange(p.date)) continue;
      const d = dayInfo.get(p.dayId)!;
      entries.push({
        ...base,
        key: `plan-${a.id}-${p.dayId}`,
        date: p.date,
        dayName: d.name,
        sessionType: d.sessionType,
        status: p.date < today ? "missed" : p.date === today ? "today" : "upcoming",
      });
    }
  }

  return entries.sort((x, y) => x.date.localeCompare(y.date) || x.dayName.localeCompare(y.dayName));
}
