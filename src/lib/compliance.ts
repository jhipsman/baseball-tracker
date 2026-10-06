import type { CalendarEntry } from "./calendar";

export type Compliance = {
  due: number;
  logged: number;
  missed: number;
  skipped: number;
  /** 0–1, or null when nothing was due. */
  rate: number | null;
};

/**
 * Compliance from calendar entries: of the workouts that were due (planned on
 * or before today), how many were logged as completed or partial.
 */
export function complianceOf(entries: CalendarEntry[]): Compliance {
  let logged = 0;
  let missed = 0;
  let skipped = 0;
  for (const e of entries) {
    if (e.status === "completed" || e.status === "partial") logged += 1;
    else if (e.status === "missed") missed += 1;
    else if (e.status === "skipped") skipped += 1;
  }
  const due = logged + missed + skipped;
  return { due, logged, missed, skipped, rate: due === 0 ? null : logged / due };
}

export function complianceByPlayer(entries: CalendarEntry[]) {
  const byPlayer = new Map<string, CalendarEntry[]>();
  for (const e of entries) byPlayer.set(e.playerId, [...(byPlayer.get(e.playerId) ?? []), e]);
  return new Map([...byPlayer].map(([id, list]) => [id, complianceOf(list)]));
}

/** "Needs attention" when a player has missed work recently or logs less than half of it. */
export function needsAttention(c: Compliance | undefined) {
  if (!c || c.due === 0) return false;
  return (c.rate ?? 1) < 0.5 || c.missed >= 2;
}
