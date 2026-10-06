/**
 * Throwing workload rules.
 *
 * Pitch counts follow MLB / USA Baseball Pitch Smart guidelines (daily max and
 * required rest days by age). They apply to competitive pitching (games and
 * live at-bats). Bullpens and throwing sessions count toward overall workload
 * (acute:chronic ratio) but not toward Pitch Smart rest.
 *
 * These are guidelines, not medical advice; leagues may set stricter rules.
 */
import { addDays, daysBetween } from "./schedule";

export type ThrowType = "long_toss" | "flat_ground" | "bullpen" | "live_abs" | "game" | "check_in";
export type ArmFeel = "great" | "good" | "okay" | "tired" | "sore" | "pain";

export type ThrowLog = {
  date: string;
  type: ThrowType;
  pitches: number;
  armFeel: ArmFeel | null;
};

export type PitchSmartBand = {
  ages: string;
  dailyMax: number;
  /** Upper pitch count for 0, 1, 2, 3 rest days; anything above needs 4. */
  restThresholds: [number, number, number, number];
};

const YOUTH: PitchSmartBand["restThresholds"] = [20, 35, 50, 65];
const TEEN_ADULT: PitchSmartBand["restThresholds"] = [30, 45, 60, 75];

export function pitchSmartBand(age: number): PitchSmartBand {
  if (age <= 8) return { ages: "7–8", dailyMax: 50, restThresholds: YOUTH };
  if (age <= 10) return { ages: "9–10", dailyMax: 75, restThresholds: YOUTH };
  if (age <= 12) return { ages: "11–12", dailyMax: 85, restThresholds: YOUTH };
  if (age <= 14) return { ages: "13–14", dailyMax: 95, restThresholds: YOUTH };
  if (age <= 16) return { ages: "15–16", dailyMax: 95, restThresholds: TEEN_ADULT };
  if (age <= 18) return { ages: "17–18", dailyMax: 105, restThresholds: TEEN_ADULT };
  return { ages: "19–22", dailyMax: 120, restThresholds: TEEN_ADULT };
}

export function requiredRestDays(age: number, pitches: number) {
  if (pitches <= 0) return 0;
  const t = pitchSmartBand(age).restThresholds;
  const i = t.findIndex((max) => pitches <= max);
  return i === -1 ? 4 : i;
}

export function ageOn(birthDate: string, date: string) {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = date.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

const COMPETITIVE: ReadonlySet<ThrowType> = new Set(["game", "live_abs"]);

/** Competitive pitches per day. */
export function competitiveByDay(logs: ThrowLog[]) {
  const byDay = new Map<string, number>();
  for (const l of logs) {
    if (COMPETITIVE.has(l.type)) byDay.set(l.date, (byDay.get(l.date) ?? 0) + l.pitches);
  }
  return byDay;
}

export type Availability =
  | { state: "unknown_age" }
  | { state: "available"; pitchesToday: number; remainingToday: number; dailyMax: number }
  | { state: "resting"; until: string; daysLeft: number; dailyMax: number };

/** Can this player pitch competitively today under Pitch Smart? */
export function availability(
  logs: ThrowLog[],
  birthDate: string | null,
  today: string,
): Availability {
  if (!birthDate) return { state: "unknown_age" };
  const age = ageOn(birthDate, today);
  const { dailyMax } = pitchSmartBand(age);
  const byDay = competitiveByDay(logs);

  let until: string | null = null;
  for (const [date, pitches] of byDay) {
    if (date >= today) continue;
    const rest = requiredRestDays(ageOn(birthDate, date), pitches);
    const nextOk = addDays(date, rest + 1);
    if (nextOk > today && (!until || nextOk > until)) until = nextOk;
  }
  if (until) return { state: "resting", until, daysLeft: daysBetween(today, until), dailyMax };

  const pitchesToday = byDay.get(today) ?? 0;
  return {
    state: "available",
    pitchesToday,
    remainingToday: Math.max(0, dailyMax - pitchesToday),
    dailyMax,
  };
}

/** Total throws (all sessions except check-ins) in [from, to]. */
export function throwsBetween(logs: ThrowLog[], from: string, to: string) {
  return logs
    .filter((l) => l.type !== "check_in" && l.date >= from && l.date <= to)
    .reduce((n, l) => n + l.pitches, 0);
}

/**
 * Acute:chronic workload ratio on throw volume: last 7 days vs the weekly
 * average of the last 28. Needs 3+ weeks of history to mean anything.
 */
export function acuteChronic(logs: ThrowLog[], today: string) {
  const throwing = logs.filter((l) => l.type !== "check_in" && l.pitches > 0);
  if (throwing.length === 0) return null;
  const first = throwing.reduce((min, l) => (l.date < min ? l.date : min), throwing[0].date);
  if (daysBetween(first, today) < 21) return null;
  const acute = throwsBetween(logs, addDays(today, -6), today);
  const chronic = throwsBetween(logs, addDays(today, -27), today) / 4;
  if (chronic === 0) return null;
  return { acute, chronic, ratio: acute / chronic };
}

export type Alert = { level: "critical" | "warning" | "info"; message: string };

export function throwingAlerts(logs: ThrowLog[], birthDate: string | null, today: string): Alert[] {
  const alerts: Alert[] = [];
  const week = logs.filter((l) => l.date >= addDays(today, -6) && l.date <= today);
  const byDay = competitiveByDay(logs);

  // Arm feel
  const latestFeel = logs
    .filter((l) => l.armFeel && l.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (latestFeel?.armFeel === "pain" && latestFeel.date >= addDays(today, -6)) {
    alerts.push({ level: "critical", message: `Reported arm pain on ${latestFeel.date}` });
  }
  const sore = week.filter((l) => l.armFeel === "sore" || l.armFeel === "pain").length;
  if (sore >= 2)
    alerts.push({ level: "warning", message: `Sore or painful arm ${sore}× in the last 7 days` });
  const tired = week.filter((l) => l.armFeel === "tired").length;
  if (tired >= 3)
    alerts.push({ level: "warning", message: `Tired arm ${tired}× in the last 7 days` });

  if (birthDate) {
    // Over the daily max, or pitched before the required rest was up (last 14 days).
    const recent = [...byDay].filter(([d]) => d >= addDays(today, -13) && d <= today).sort();
    for (const [date, pitches] of recent) {
      const age = ageOn(birthDate, date);
      const { dailyMax } = pitchSmartBand(age);
      if (pitches > dailyMax) {
        alerts.push({
          level: "critical",
          message: `${pitches} pitches on ${date}: over the Pitch Smart daily max of ${dailyMax} for age ${age}`,
        });
      }
    }
    for (const [date] of recent) {
      const earlier = [...byDay].filter(([d]) => d < date);
      const tooSoon = earlier.find(
        ([d, p]) => addDays(d, requiredRestDays(ageOn(birthDate, d), p) + 1) > date,
      );
      if (tooSoon) {
        alerts.push({
          level: "critical",
          message: `Pitched on ${date} before the required rest after ${tooSoon[1]} pitches on ${tooSoon[0]}`,
        });
      }
    }
  } else if (byDay.size > 0) {
    alerts.push({ level: "info", message: "Add a birthdate to check Pitch Smart limits" });
  }

  const acwr = acuteChronic(logs, today);
  if (acwr && acwr.ratio > 1.5) {
    alerts.push({
      level: acwr.ratio > 2 ? "critical" : "warning",
      message: `Throwing volume spike: ${acwr.acute} throws this week vs ${Math.round(acwr.chronic)}/week usual (${acwr.ratio.toFixed(1)}×)`,
    });
  }

  const order = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}

/** One entry per day from `from` to `to` for the throws chart. */
export function dailySeries(logs: ThrowLog[], from: string, to: string) {
  const out: { date: string; competitive: number; other: number; armFeel: ArmFeel | null }[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const day = logs.filter((l) => l.date === d);
    out.push({
      date: d,
      competitive: day.filter((l) => COMPETITIVE.has(l.type)).reduce((n, l) => n + l.pitches, 0),
      other: day
        .filter((l) => !COMPETITIVE.has(l.type) && l.type !== "check_in")
        .reduce((n, l) => n + l.pitches, 0),
      armFeel: day.find((l) => l.armFeel)?.armFeel ?? null,
    });
  }
  return out;
}
