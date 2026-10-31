/**
 * Player Health, put together: Pitch Smart availability, arm alerts the coach
 * hasn't handled yet, and the coach's own call (full / limited / out).
 * Pure, so the Today board, the player page and the pitcher picker agree.
 */
import type { Alert, ArmFeel, Availability } from "./workload";
import type { BodyCheckin } from "./body";

export type HealthState = "full" | "limited" | "out";
export type PlanStep = { label: string; done: boolean };
export type InjuryType =
  "soreness" | "strain" | "sprain" | "bruise" | "fracture" | "concussion" | "illness" | "other";
export type Side = "left" | "right" | "both";
export type Injury = {
  type: InjuryType | null;
  bodyPart: string | null;
  side: Side | null;
  startedOn: string | null;
  /** A doctor's note / written clearance on file (team-docs path). */
  clearancePath: string | null;
  clearanceAt: string | null;
};
export type HealthStatus = {
  status: HealthState;
  reason: string | null;
  returnDate: string | null;
  plan: PlanStep[];
  injury: Injury;
};

export const NO_INJURY: Injury = {
  type: null,
  bodyPart: null,
  side: null,
  startedOn: null,
  clearancePath: null,
  clearanceAt: null,
};

export const INJURY_TYPES: { key: InjuryType; label: string }[] = [
  { key: "soreness", label: "Soreness / tightness" },
  { key: "strain", label: "Strain (muscle)" },
  { key: "sprain", label: "Sprain (joint)" },
  { key: "bruise", label: "Bruise / hit by ball" },
  { key: "fracture", label: "Fracture (suspected)" },
  { key: "concussion", label: "Concussion (suspected)" },
  { key: "illness", label: "Illness" },
  { key: "other", label: "Other" },
];
export const INJURY_TYPE = Object.fromEntries(INJURY_TYPES.map((t) => [t.key, t.label])) as Record<
  InjuryType,
  string
>;
export const isInjuryType = (v: unknown): v is InjuryType =>
  typeof v === "string" && v in INJURY_TYPE;

/** Body areas, in the order they appear on the body outline. `arm` ones use return-to-throw. */
export const BODY_PARTS: { key: string; label: string; arm?: true; sided?: true }[] = [
  { key: "head", label: "Head / face" },
  { key: "neck", label: "Neck" },
  { key: "shoulder", label: "Shoulder", arm: true, sided: true },
  { key: "elbow", label: "Elbow", arm: true, sided: true },
  { key: "forearm", label: "Forearm / wrist", arm: true, sided: true },
  { key: "hand", label: "Hand / fingers", sided: true },
  { key: "chest", label: "Chest / ribs" },
  { key: "abs", label: "Core / obliques" },
  { key: "upper_back", label: "Upper back" },
  { key: "lower_back", label: "Lower back" },
  { key: "hip", label: "Hip / groin", sided: true },
  { key: "quad", label: "Quad / thigh", sided: true },
  { key: "hamstring", label: "Hamstring", sided: true },
  { key: "knee", label: "Knee", sided: true },
  { key: "shin", label: "Shin / calf", sided: true },
  { key: "ankle", label: "Ankle / foot", sided: true },
];
export const BODY_PART = Object.fromEntries(BODY_PARTS.map((b) => [b.key, b]));
export const isBodyPart = (v: unknown): v is string => typeof v === "string" && v in BODY_PART;

const cap = (t: string) => t[0].toUpperCase() + t.slice(1);

/** "Left elbow sprain", "Concussion protocol", "Illness", "Lower back"… */
export function injuryLabel(i: Pick<Injury, "type" | "bodyPart" | "side">): string | null {
  if (i.type === "concussion") return "Concussion protocol";
  if (i.type === "illness") return "Illness";
  const part = i.bodyPart ? BODY_PART[i.bodyPart]?.label.split(" / ")[0].toLowerCase() : null;
  const where = part
    ? i.side === "left" || i.side === "right"
      ? `${i.side} ${part}`
      : part
    : null;
  const what =
    i.type && i.type !== "other" ? INJURY_TYPE[i.type].split(/ \(| \//)[0].toLowerCase() : null;
  const text = [where, what].filter(Boolean).join(" ");
  return text ? cap(text) : null;
}

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

/**
 * Graduated return to play after a suspected concussion (the widely used
 * 6-step approach). At least 24 symptom-free hours per step; written clearance
 * is required before full practice. A checklist, not medical advice.
 */
export const CONCUSSION_PROTOCOL: string[] = [
  "Back to normal daily activity and school without symptoms",
  "Light aerobic activity: walking or a stationary bike",
  "Moderate activity: jogging, light catch",
  "Non-contact drills: throwing, tee work, fielding",
  "Doctor's written clearance uploaded",
  "Full practice",
  "Back in games",
];

/** For any injury that isn't the throwing arm. */
export const RETURN_TO_PLAY: string[] = [
  "Pain-free walking and daily activity",
  "Full range of motion and strength back",
  "Running and agility drills",
  "Baseball drills at full speed",
  "Full practice",
  "Cleared by a doctor or trainer if one saw them",
];

/** Which checklist a new injury starts from. */
export function planFor(type: InjuryType | null, bodyPart: string | null): string[] {
  if (type === "concussion" || bodyPart === "head") return CONCUSSION_PROTOCOL;
  if (bodyPart && BODY_PART[bodyPart]?.arm) return RETURN_TO_THROW;
  if (type === "illness") return [];
  return bodyPart || type ? RETURN_TO_PLAY : RETURN_TO_THROW;
}

/** What the plan's checklist is called for this injury. */
export function planTitle(i: Pick<Injury, "type" | "bodyPart">): string {
  if (i.type === "concussion") return "Concussion protocol";
  if (!i.bodyPart || BODY_PART[i.bodyPart]?.arm) return "Return to throw";
  return "Return to play";
}

/** A concussion can't come back to Full (or Limited→Full) without clearance on file. */
export const needsClearance = (s: HealthStatus) =>
  s.status !== "full" && s.injury.type === "concussion" && !s.injury.clearancePath;

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

export const STATUS_COLUMNS =
  "status, reason, return_date, plan, injury_type, body_part, side, started_on, clearance_path, clearance_at";

/** A player_health_status row (selected with STATUS_COLUMNS) as a HealthStatus. */
export function toHealthStatus(r: {
  status: HealthState;
  reason: string | null;
  return_date: string | null;
  plan: unknown;
  injury_type: string | null;
  body_part: string | null;
  side: string | null;
  started_on: string | null;
  clearance_path: string | null;
  clearance_at: string | null;
}): HealthStatus {
  return {
    status: r.status,
    reason: r.reason,
    returnDate: r.return_date,
    plan: parsePlan(r.plan),
    injury: {
      type: isInjuryType(r.injury_type) ? r.injury_type : null,
      bodyPart: isBodyPart(r.body_part) ? r.body_part : null,
      side: r.side === "left" || r.side === "right" || r.side === "both" ? r.side : null,
      startedOn: r.started_on,
      clearancePath: r.clearance_path,
      clearanceAt: r.clearance_at,
    },
  };
}

export const FULL: HealthStatus = {
  status: "full",
  reason: null,
  returnDate: null,
  plan: [],
  injury: NO_INJURY,
};

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
  /** Latest body check-in this week, if any. */
  body: BodyCheckin | null;
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
  body?: BodyCheckin | null;
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
  const what = injuryLabel(status.injury);
  const detail =
    lane === "out" || lane === "limited"
      ? `${[what, status.reason].filter(Boolean).join(": ") || (lane === "out" ? "Out" : "Limited")}${back}`
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
    body: input.body ?? null,
    detail,
  };
}
