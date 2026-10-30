/**
 * Player Health, put together: Pitch Smart availability, arm alerts the coach
 * hasn't handled yet, and the coach's own call (full / limited / out).
 * Pure, so the Today board, the player page and the pitcher picker agree.
 */
import type { Alert, ArmFeel, Availability } from "./workload";

export type HealthState = "full" | "limited" | "out";
export type PlanStep = { label: string; done: boolean };
export type HealthStatus = {
  status: HealthState;
  reason: string | null;
  returnDate: string | null;
  plan: PlanStep[];
};

/**
 * A common, conservative return-to-throw progression. Coaches edit it; it is a
 * checklist, not medical advice, and the last step waits on a clinician's OK.
 */
export const RETURN_TO_THROW: string[] = [
  "Pain-free at rest and with daily activity",
  "Light catch, 30–45 ft",
  "Catch, 60–90 ft",
  "Long toss, 120 ft",
  "Flat ground at 50–75%",
  "Bullpen at 75%",
  "Full bullpen",
  "Live at-bats",
  "Cleared by a doctor or trainer",
];

export function parsePlan(raw: unknown): PlanStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 12).flatMap((x) => {
    if (!x || typeof x !== "object") return [];
    const { label, done } = x as Record<string, unknown>;
    return typeof label === "string" && label.trim()
      ? [{ label: label.trim().slice(0, 80), done: done === true }]
      : [];
  });
}

export const FULL: HealthStatus = { status: "full", reason: null, returnDate: null, plan: [] };

/** Where a player sits on the Today board, most urgent first. */
export type Lane = "out" | "attention" | "limited" | "resting" | "ready";
export const LANES: { key: Lane; title: string; hint: string }[] = [
  { key: "attention", title: "Needs a look", hint: "New arm or workload alerts" },
  { key: "out", title: "Out", hint: "Not playing" },
  { key: "limited", title: "Limited", hint: "Playing with limits" },
  { key: "resting", title: "Can't pitch today", hint: "Pitch Smart rest" },
  { key: "ready", title: "Ready", hint: "Good to go" },
];

export type PlayerHealth = {
  id: string;
  name: string;
  lane: Lane;
  status: HealthStatus;
  /** Alerts still waiting on the coach (info-level ones never block). */
  open: Alert[];
  handled: Alert[];
  avail: Availability;
  /** Most recent arm feel, if any in the last week. */
  feel: { feel: ArmFeel; date: string } | null;
  checkedInToday: boolean;
  /** Short line for the card: the coach's reason, "Rest until Tue", "Up to 85 pitches"… */
  detail: string;
};

export function playerHealth(input: {
  id: string;
  name: string;
  status: HealthStatus | null;
  alerts: Alert[];
  acked: Set<string>;
  avail: Availability;
  feel: { feel: ArmFeel; date: string } | null;
  checkedInToday: boolean;
  /** "Tue, Nov 3" style label for a date. */
  dateLabel: (date: string) => string;
}): PlayerHealth {
  const status = input.status ?? FULL;
  const real = input.alerts.filter((a) => a.level !== "info");
  const open = real.filter((a) => !input.acked.has(a.key));
  const handled = real.filter((a) => input.acked.has(a.key));
  const lane: Lane =
    status.status === "out"
      ? "out"
      : open.length
        ? "attention"
        : status.status === "limited"
          ? "limited"
          : input.avail.state === "resting"
            ? "resting"
            : "ready";
  const back = status.returnDate ? ` · back ${input.dateLabel(status.returnDate)}` : "";
  const detail =
    lane === "out" || lane === "limited"
      ? `${status.reason || (lane === "out" ? "Out" : "Limited")}${back}`
      : input.avail.state === "resting"
        ? `Rest until ${input.dateLabel(input.avail.until)}`
        : input.avail.state === "available"
          ? `Up to ${input.avail.remainingToday} pitches today`
          : "Add a birthday for pitch limits";
  return {
    id: input.id,
    name: input.name,
    lane,
    status,
    open,
    handled,
    avail: input.avail,
    feel: input.feel,
    checkedInToday: input.checkedInToday,
    detail,
  };
}
