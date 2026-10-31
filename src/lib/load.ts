/**
 * Whole-athlete load: session load (minutes × effort 1–10) from logged
 * workouts and team practices/games, growth spurts from monthly heights, and
 * the Pitch Smart "don't pitch and catch the same day" rule. Pure.
 */
import { addDays } from "./schedule";
import type { Alert } from "./workload";

export type Session = { date: string; minutes: number; rpe: number; source: "workout" | "team" };
export type Height = { date: string; inches: number };

const weekStart = (day: string) =>
  addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));

/** This week's load vs the usual week (the 4 weeks before), once there's 3+ weeks of history. */
export function trainingLoad(sessions: Session[], today: string) {
  const inRange = (from: string, to: string) =>
    sessions
      .filter((s) => s.date >= from && s.date <= to)
      .reduce((sum, s) => sum + s.minutes * s.rpe, 0);
  const acute = inRange(addDays(today, -6), today);
  const chronic = inRange(addDays(today, -34), addDays(today, -7)) / 4;
  const first = sessions.reduce<string | null>((m, s) => (!m || s.date < m ? s.date : m), null);
  const enoughHistory = !!first && first <= addDays(today, -21);
  return {
    acute,
    chronic,
    ratio: enoughHistory && chronic > 0 ? acute / chronic : null,
  };
}

/** Rate of growth, inches per year, between the latest height and one 2–7 months earlier. */
export function growthRate(heights: Height[]) {
  const sorted = [...heights].sort((a, b) => (a.date < b.date ? 1 : -1));
  const last = sorted[0];
  if (!last) return null;
  const earlier = sorted.find(
    (h) => h.date <= addDays(last.date, -60) && h.date >= addDays(last.date, -213),
  );
  if (!earlier) return null;
  const days =
    (Date.parse(`${last.date}T12:00:00Z`) - Date.parse(`${earlier.date}T12:00:00Z`)) / 86_400_000;
  const gained = last.inches - earlier.inches;
  return { gained, months: Math.round(days / 30.4), perYear: (gained / days) * 365, last };
}

/** About 3+ inches a year counts as a growth spurt. */
export const SPURT_IN_PER_YEAR = 3;

export function loadAlerts(input: {
  sessions: Session[];
  heights: Height[];
  /** Days the player pitched in a game or live ABs, and days they caught in a game. */
  pitchedDays: string[];
  caughtDays: string[];
  today: string;
}): Alert[] {
  const { today } = input;
  const alerts: Alert[] = [];
  const load = trainingLoad(input.sessions, today);
  if (load.ratio && load.ratio > 1.5 && load.acute >= 600)
    alerts.push({
      level: load.ratio > 2 ? "critical" : "warning",
      message: `Training load spike: ${Math.round(load.acute)} this week vs ${Math.round(load.chronic)}/week usual (${load.ratio.toFixed(1)}×)`,
      key: `load:${weekStart(today)}`,
    });
  const g = growthRate(input.heights);
  if (g && g.perYear >= SPURT_IN_PER_YEAR && g.last.date >= addDays(today, -90))
    alerts.push({
      level: "warning",
      message: `Growing fast: +${g.gained.toFixed(1)} in over ${g.months} months. Growth spurts raise injury risk; go easy on volume.`,
      key: `growth:${g.last.date}`,
    });
  const pitched = new Set(input.pitchedDays);
  const both = [...new Set(input.caughtDays)]
    .filter((d) => pitched.has(d) && d >= addDays(today, -6) && d <= today)
    .sort()
    .reverse();
  if (both.length)
    alerts.push({
      level: "warning",
      message: `Pitched and caught on the same day (${both[0]}). Pitch Smart: avoid catching on pitching days.`,
      key: `catchpitch:${both[0]}`,
    });
  return alerts;
}
