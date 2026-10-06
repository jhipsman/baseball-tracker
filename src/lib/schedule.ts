/**
 * Works out where a player is in an assigned program.
 *
 * Weeks run in 7-day blocks from the assignment's start date. Within a week:
 * - days pinned to a weekday (day_of_week) are "today" on that weekday;
 * - otherwise days are done in order, so "today" is the first one not logged yet.
 */

export type ScheduleDay = { id: string; dayOfWeek: number | null };
export type ScheduleWeek = { days: ScheduleDay[] };

export type Schedule =
  | { state: "upcoming"; startsInDays: number }
  | { state: "finished" }
  | {
      state: "active";
      weekIndex: number;
      /** The day to do today, or null for a rest day / finished week. */
      todayDayId: string | null;
      /** Earliest unlogged day this week (to catch up on), if different from today's. */
      catchUpDayId: string | null;
      weekComplete: boolean;
    };

const DAY_MS = 86_400_000;

/** Days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string) {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday for a YYYY-MM-DD date. */
export function dayOfWeek(date: string) {
  return new Date(toUtc(date)).getUTCDay();
}

export function addDays(date: string, days: number) {
  return new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10);
}

function toUtc(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function scheduleFor(
  startDate: string,
  today: string,
  weeks: ScheduleWeek[],
  loggedDayIds: ReadonlySet<string>,
): Schedule {
  const elapsed = daysBetween(startDate, today);
  if (elapsed < 0) return { state: "upcoming", startsInDays: -elapsed };

  const weekIndex = Math.floor(elapsed / 7);
  if (weekIndex >= weeks.length) return { state: "finished" };

  const days = weeks[weekIndex].days;
  const unlogged = days.filter((d) => !loggedDayIds.has(d.id));
  const weekComplete = days.length > 0 && unlogged.length === 0;
  const pinned = days.some((d) => d.dayOfWeek != null);

  let todayDayId: string | null;
  if (pinned) {
    const dow = dayOfWeek(today);
    todayDayId = days.find((d) => d.dayOfWeek === dow)?.id ?? null;
  } else {
    todayDayId = unlogged[0]?.id ?? null;
  }

  const catchUp = unlogged.find((d) => d.id !== todayDayId);
  // Only offer catch-up for pinned days whose weekday has already passed.
  const catchUpDayId =
    catchUp && pinned
      ? catchUp.dayOfWeek != null && isEarlierInWeek(catchUp.dayOfWeek, startDate, today)
        ? catchUp.id
        : null
      : null;

  return { state: "active", weekIndex, todayDayId, catchUpDayId, weekComplete };
}

/** Has `dow` already occurred in the current program week (which starts on the start date's weekday)? */
function isEarlierInWeek(dow: number, startDate: string, today: string) {
  const weekStartDow = dayOfWeek(startDate);
  const offset = (d: number) => (d - weekStartDow + 7) % 7;
  return offset(dow) < offset(dayOfWeek(today));
}

/** Today's date (YYYY-MM-DD) in an IANA time zone, falling back to UTC. */
export function todayIn(timeZone: string | undefined, now = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/**
 * Calendar date for every day of a program.
 * - Week w starts on startDate + 7w.
 * - Weekday-pinned days land on that weekday within the week.
 * - Flexible days are spread evenly through the week in order
 *   (e.g. 3 days → offsets 0, 2, 4), so a coach sees a sensible plan.
 */
export function planDates(startDate: string, weeks: ScheduleWeek[]) {
  const startDow = dayOfWeek(startDate);
  const out: { dayId: string; weekIndex: number; date: string }[] = [];
  weeks.forEach((week, w) => {
    const weekStart = addDays(startDate, w * 7);
    const n = week.days.length;
    week.days.forEach((d, i) => {
      const offset =
        d.dayOfWeek != null
          ? (d.dayOfWeek - startDow + 7) % 7
          : Math.floor((i * 7) / Math.max(n, 1));
      out.push({ dayId: d.id, weekIndex: w, date: addDays(weekStart, offset) });
    });
  });
  return out;
}

/** Sunday-start week containing `date`. */
export function weekStartOf(date: string) {
  return addDays(date, -dayOfWeek(date));
}
