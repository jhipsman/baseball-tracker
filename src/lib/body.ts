/**
 * The daily body check-in: overall feel, sore spots (from the body map) and
 * sleep, and the alerts it raises for coaches. Pure; no diagnosis, just
 * "this changed, take a look".
 */
import { BODY_PART } from "./health";
import { addDays } from "./schedule";
import type { Alert } from "./workload";

export type BodyCheckin = {
  date: string;
  feel: number;
  sore: string[];
  sleep: Sleep | null;
  note: string | null;
};
export type Sleep = "under6" | "6to7" | "8plus";

export const FEELS: { value: number; label: string; face: string; className: string }[] = [
  { value: 1, label: "Awful", face: "😫", className: "bg-red-100 text-red-900" },
  { value: 2, label: "Rough", face: "🙁", className: "bg-orange-50 text-orange-950" },
  { value: 3, label: "Okay", face: "😐", className: "bg-amber-100 text-amber-950" },
  { value: 4, label: "Good", face: "🙂", className: "bg-brand-100 text-brand-900" },
  { value: 5, label: "Great", face: "💪", className: "bg-brand-200 text-brand-900" },
];
export const feelOf = (v: number) => FEELS.find((f) => f.value === v) ?? FEELS[2];

export const SLEEPS: { key: Sleep; label: string }[] = [
  { key: "under6", label: "Under 6 h" },
  { key: "6to7", label: "6–7 h" },
  { key: "8plus", label: "8 h +" },
];

/** "knee:left" → "Left knee"; unknown spots are dropped by isSpot. */
export function spotName(spot: string): string {
  const [part, side] = spot.split(":");
  const label = (BODY_PART[part]?.label ?? part).split(" / ")[0];
  return side ? `${side[0].toUpperCase()}${side.slice(1)} ${label.toLowerCase()}` : label;
}
export const isSpot = (v: unknown): v is string => {
  if (typeof v !== "string") return false;
  const [part, side, extra] = v.split(":");
  if (extra !== undefined || !BODY_PART[part]) return false;
  if (side === undefined) return !BODY_PART[part].sided;
  return !!BODY_PART[part].sided && (side === "left" || side === "right");
};

/**
 * Alerts from a player's recent check-ins (newest first or any order):
 * feeling rough (1–2), a sore spot that's new versus the two weeks before, or
 * the same spot sore on 3+ check-ins in a week. Only the latest check-in, and
 * only if it's from today or yesterday.
 */
export function bodyAlerts(checkins: BodyCheckin[], today: string): Alert[] {
  const sorted = [...checkins]
    .filter((c) => c.date <= today)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const last = sorted[0];
  if (!last || last.date < addDays(today, -1)) return [];
  const alerts: Alert[] = [];
  if (last.feel <= 2)
    alerts.push({
      level: "warning",
      message: `Feeling ${feelOf(last.feel).label.toLowerCase()} overall${last.note ? `: “${last.note}”` : ""}`,
      key: `feel:${last.date}`,
    });
  const before = sorted.filter((c) => c.date < last.date && c.date >= addDays(last.date, -14));
  const seen = new Set(before.flatMap((c) => c.sore));
  const fresh = last.sore.filter((s) => !seen.has(s));
  if (fresh.length)
    alerts.push({
      level: "warning",
      message: `New soreness: ${fresh.map(spotName).join(", ")}`,
      key: `newsore:${last.date}`,
    });
  const week = sorted.filter((c) => c.date > addDays(last.date, -7));
  const lingering = last.sore.filter(
    (s) => !fresh.includes(s) && week.filter((c) => c.sore.includes(s)).length >= 3,
  );
  if (lingering.length)
    alerts.push({
      level: "warning",
      message: `Still sore after 3+ check-ins this week: ${lingering.map(spotName).join(", ")}`,
      key: `lingering:${last.date}`,
    });
  return alerts;
}
