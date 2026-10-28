import { DISTANCE_UNITS, type DistanceUnit, type TrackingType } from "@/constants";

/**
 * One set as stored in `exercise_logs.sets_completed` (jsonb array).
 *
 * Weight × reps logs (Phase 2) only have `reps`, `weight`, `rpe`, `done`. Time and
 * distance exercises (Phase 7) add `time_s`, `distance`, `distance_unit`. Every
 * field is optional when reading, because older rows predate the new keys.
 */
export type LoggedSet = {
  set: number;
  reps: number | string | null;
  weight: number | null;
  rpe: number | null;
  done: boolean;
  /** Seconds, decimals allowed (7.12). */
  time_s?: number | null;
  distance?: number | null;
  distance_unit?: DistanceUnit | null;
};

type LooseSet = Partial<LoggedSet>;

export function isDistanceUnit(value: unknown): value is DistanceUnit {
  return typeof value === "string" && (DISTANCE_UNITS as readonly string[]).includes(value);
}

/** 7.1 → "7.1", 7.125 → "7.13", 60 → "60" */
export function trimNumber(n: number, digits = 2) {
  return String(Number(n.toFixed(digits)));
}

/** 7.12 → "7.12 s", 105 → "1:45", 65.3 → "1:05.3" */
export function formatSeconds(seconds: number) {
  if (seconds < 60) return `${trimNumber(seconds)} s`;
  const m = Math.floor(seconds / 60);
  const rest = Number((seconds - m * 60).toFixed(2));
  const [whole, frac] = String(rest).split(".");
  return `${m}:${whole.padStart(2, "0")}${frac ? `.${frac}` : ""}`;
}

const UNIT_ALIASES: Record<string, DistanceUnit> = {
  yd: "yd",
  yds: "yd",
  yard: "yd",
  yards: "yd",
  ft: "ft",
  feet: "ft",
  foot: "ft",
  m: "m",
  meter: "m",
  meters: "m",
  metre: "m",
  metres: "m",
};

/** "60 yd" → { value: 60, unit: "yd" }; "4x100m" → { value: 100, unit: "m" }. */
export function parseDistance(text: string): { value: number; unit: DistanceUnit } | null {
  const m = /(\d+(?:\.\d+)?)\s*(yds?|yards?|ft|feet|foot|meters?|metres?|m)\b/i.exec(text);
  if (!m) return null;
  return { value: Number(m[1]), unit: UNIT_ALIASES[m[2].toLowerCase()] };
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function hasReps(s: LooseSet) {
  return (s.reps != null && s.reps !== "") || num(s.weight) != null;
}

function hasData(s: LooseSet, type: TrackingType) {
  switch (type) {
    case "weight_reps":
    case "reps":
      return hasReps(s);
    case "time":
      return num(s.time_s) != null;
    case "distance":
      return num(s.distance) != null;
    case "distance_time":
      return num(s.distance) != null || num(s.time_s) != null;
  }
}

/**
 * The type the sets were actually logged as. Normally the exercise's current type,
 * but if the coach changed it after the fact we fall back to whatever data exists.
 */
export function effectiveTracking(sets: LooseSet[], declared: TrackingType): TrackingType {
  if (sets.some((s) => hasData(s, declared))) return declared;
  const time = sets.some((s) => num(s.time_s) != null);
  const dist = sets.some((s) => num(s.distance) != null);
  if (time && dist) return "distance_time";
  if (time) return "time";
  if (dist) return "distance";
  if (sets.some((s) => num(s.weight) != null)) return "weight_reps";
  return declared;
}

function allEqual<T>(values: T[]) {
  return values.every((v) => v === values[0]);
}

function repsText(s: LooseSet) {
  return s.reps == null || s.reps === "" ? "–" : String(s.reps);
}

/** "7.1 s (best 6.9 s)" — sprints: lower is better. */
function timeSummary(times: number[]) {
  if (times.length === 1 || allEqual(times)) return formatSeconds(times[0]);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  return `${formatSeconds(avg)} (best ${formatSeconds(Math.min(...times))})`;
}

function unitOf(s: LooseSet): DistanceUnit {
  return isDistanceUnit(s.distance_unit) ? s.distance_unit : "yd";
}

function formatWeightReps(sets: LooseSet[]) {
  const weights = sets.map((s) => num(s.weight));
  if (weights.every((w) => w == null)) return formatRepsOnly(sets);
  if (allEqual(weights)) return `${trimNumber(weights[0]!)} lb × ${sets.map(repsText).join(", ")}`;
  return sets
    .map((s) => {
      const w = num(s.weight);
      return w != null ? `${trimNumber(w)}×${repsText(s)}` : repsText(s);
    })
    .join(", ");
}

function formatRepsOnly(sets: LooseSet[]) {
  const reps = sets.map(repsText);
  return allEqual(reps) ? `${sets.length} × ${reps[0]}` : reps.join(", ");
}

function formatTime(sets: LooseSet[]) {
  const times = sets.map((s) => num(s.time_s)!);
  return times.length === 1 ? formatSeconds(times[0]) : `${times.length} × ${timeSummary(times)}`;
}

function formatDistance(sets: LooseSet[]) {
  const values = sets.map((s) => num(s.distance)!);
  const units = sets.map(unitOf);
  if (!allEqual(units))
    return sets.map((s, i) => `${trimNumber(values[i])} ${units[i]}`).join(", ");
  const u = units[0];
  if (allEqual(values)) {
    const one = `${trimNumber(values[0])} ${u}`;
    return values.length === 1 ? one : `${values.length} × ${one}`;
  }
  return `${values.map((v) => trimNumber(v)).join(", ")} ${u} (best ${trimNumber(Math.max(...values))} ${u})`;
}

function formatDistanceTime(sets: LooseSet[]) {
  const distances = sets.map((s) => num(s.distance));
  const times = sets.map((s) => num(s.time_s));
  const units = sets.map(unitOf);
  const complete = distances.every((d) => d != null) && times.every((t) => t != null);
  if (complete && allEqual(distances) && allEqual(units)) {
    const one = `${trimNumber(distances[0]!)} ${units[0]}`;
    const t = timeSummary(times as number[]);
    return sets.length === 1 ? `${one} in ${t}` : `${sets.length} × ${one} in ${t}`;
  }
  return sets
    .map((_, i) => {
      const d = distances[i] != null ? `${trimNumber(distances[i]!)} ${units[i]}` : null;
      const t = times[i] != null ? formatSeconds(times[i]!) : null;
      return d && t ? `${d} in ${t}` : (d ?? t);
    })
    .join(", ");
}

/**
 * Human summary of the logged sets for one exercise:
 *   weight_reps   "185 lb × 5, 5, 4" · "135×8, 155×6"
 *   reps          "3 × 10" · "10, 8, 8"
 *   time          "3 × 7.1 s (best 6.9 s)"
 *   distance      "3 × 40 yd" · "40, 50 yd (best 50 yd)"
 *   distance_time "500 m in 1:45" · "3 × 60 yd in 7.1 s (best 6.9 s)"
 * Returns "" when nothing was logged.
 */
export function formatSets(
  raw: unknown,
  declared: TrackingType = "weight_reps",
  opts: { rpe?: boolean; notDone?: boolean } = {},
): string {
  const all: LooseSet[] = Array.isArray(raw)
    ? raw.filter((s): s is LooseSet => !!s && typeof s === "object")
    : [];
  const type = effectiveTracking(all, declared);
  const sets = all.filter((s) => hasData(s, type));
  if (sets.length === 0) return "";

  let text: string;
  switch (type) {
    case "weight_reps":
      text = formatWeightReps(sets);
      break;
    case "reps":
      text = formatRepsOnly(sets);
      break;
    case "time":
      text = formatTime(sets);
      break;
    case "distance":
      text = formatDistance(sets);
      break;
    case "distance_time":
      text = formatDistanceTime(sets);
      break;
  }

  if (opts.rpe) {
    const rpes = sets.map((s) => num(s.rpe)).filter((r): r is number => r != null);
    if (rpes.length > 0) {
      const lo = Math.min(...rpes);
      const hi = Math.max(...rpes);
      text += ` @ RPE ${lo === hi ? trimNumber(lo) : `${trimNumber(lo)}–${trimNumber(hi)}`}`;
    }
  }
  if (opts.notDone) {
    const missed = sets.filter((s) => s.done === false).length;
    if (missed > 0) text += ` (${missed} not done)`;
  }
  return text;
}

/** Fastest logged time, for "beat your best" hints on sprints. */
export function bestTime(raw: unknown): number | null {
  if (!Array.isArray(raw)) return null;
  const times = raw
    .map((s) => (s && typeof s === "object" ? num((s as LooseSet).time_s) : null))
    .filter((t): t is number => t != null && t > 0);
  return times.length ? Math.min(...times) : null;
}
