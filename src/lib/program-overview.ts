/**
 * A readable summary of a program for the program page: what every session
 * shares, what's special about each day, and what changes week to week.
 * Pure (no data access) so it can be unit tested.
 */

export type OverviewExercise = {
  exerciseId: string;
  name: string;
  /** Prescription, e.g. "2 × 15" or "1 × 20 pitches · @ 75%". */
  dose: string;
  notes: string;
};

export type OverviewDay = {
  id: string;
  name: string;
  /** Exercises unique to this day (the week's shared routine is listed once). */
  items: OverviewExercise[];
  total: number;
};

export type OverviewWeek = {
  number: number;
  label: string;
  /** Exercises every day of this week starts with, at the same dose. */
  shared: OverviewExercise[];
  days: OverviewDay[];
};

export type ProgressionRow = {
  /** e.g. "Bullpen Session" or "Bullpen Session (Bullpen, day 3)" when it appears on several days. */
  label: string;
  /** One value per week ("" when that week doesn't have it). */
  values: string[];
};

type InWeek = {
  number: number;
  label: string;
  days: { id: string; name: string; items: OverviewExercise[] }[];
};

export function programOverview(weeks: InWeek[]): {
  weeks: OverviewWeek[];
  progression: ProgressionRow[];
} {
  const out: OverviewWeek[] = weeks.map((w) => {
    const days = w.days;
    // Shared = in every day (2+ days) with the same dose.
    const shared =
      days.length >= 2
        ? days[0].items.filter((it) =>
            days.every((d) =>
              d.items.some((x) => x.exerciseId === it.exerciseId && x.dose === it.dose),
            ),
          )
        : [];
    const isShared = (it: OverviewExercise) =>
      shared.some((s) => s.exerciseId === it.exerciseId && s.dose === it.dose);
    return {
      number: w.number,
      label: w.label,
      shared,
      days: days.map((d) => ({
        id: d.id,
        name: d.name,
        items: d.items.filter((it) => !isShared(it)),
        total: d.items.length,
      })),
    };
  });

  // Progression: the same exercise in the same day slot whose dose changes across weeks.
  const slots = new Map<
    string,
    { name: string; dayName: string; dayIndex: number; values: string[] }
  >();
  weeks.forEach((w, wi) =>
    w.days.forEach((d, di) =>
      d.items.forEach((it) => {
        const key = `${di}:${it.exerciseId}`;
        const slot = slots.get(key) ?? {
          name: it.name,
          dayName: d.name,
          dayIndex: di,
          values: Array<string>(weeks.length).fill(""),
        };
        slot.values[wi] ||= it.dose;
        slots.set(key, slot);
      }),
    ),
  );
  const changing = [...slots.values()].filter((s) => new Set(s.values.filter(Boolean)).size > 1);
  const repeated = new Map<string, number>();
  for (const s of changing) repeated.set(s.name, (repeated.get(s.name) ?? 0) + 1);
  const progression = changing.map((s) => ({
    label: (repeated.get(s.name) ?? 0) > 1 ? `${s.name} · day ${s.dayIndex + 1}` : s.name,
    values: s.values.map(compactDose),
  }));

  return { weeks: out, progression };
}

/** "1 × 30 pitches · @ 85–90%" → "30 pitches @ 85–90%" for tight table cells. */
export function compactDose(dose: string) {
  return dose.replace(/^1 × /, "").replaceAll(" · @ ", " @ ");
}

/** The program week a player who started on `startDate` is in today (0-based, clamped). */
export function currentWeekIndex(startDate: string, today: string, weekCount: number) {
  const days = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000,
  );
  if (days < 0 || weekCount === 0) return 0;
  return Math.min(Math.floor(days / 7), weekCount - 1);
}
