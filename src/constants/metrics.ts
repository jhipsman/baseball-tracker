/**
 * Assessment metrics. Stored in assessments.data as { key: number }.
 * `better` drives whether a rise is shown as improvement.
 */
export type MetricDef = {
  key: string;
  label: string;
  short: string;
  unit: string;
  better: "higher" | "lower";
  decimals: number;
  group: "Throwing" | "Hitting" | "Speed" | "Strength" | "Power" | "Body";
  min: number;
  max: number;
};

export const METRICS: MetricDef[] = [
  {
    key: "fastball_velo",
    label: "Fastball velo",
    short: "FB velo",
    unit: "mph",
    better: "higher",
    decimals: 1,
    group: "Throwing",
    min: 30,
    max: 110,
  },
  {
    key: "position_velo",
    label: "Position throw velo",
    short: "Pos. velo",
    unit: "mph",
    better: "higher",
    decimals: 1,
    group: "Throwing",
    min: 30,
    max: 110,
  },
  {
    key: "pop_time",
    label: "Pop time",
    short: "Pop",
    unit: "s",
    better: "lower",
    decimals: 2,
    group: "Throwing",
    min: 1.5,
    max: 3.5,
  },
  {
    key: "exit_velo",
    label: "Exit velo",
    short: "Exit velo",
    unit: "mph",
    better: "higher",
    decimals: 1,
    group: "Hitting",
    min: 30,
    max: 125,
  },
  {
    key: "bat_speed",
    label: "Bat speed",
    short: "Bat spd",
    unit: "mph",
    better: "higher",
    decimals: 1,
    group: "Hitting",
    min: 20,
    max: 100,
  },
  {
    key: "sixty_time",
    label: "60-yard dash",
    short: "60 yd",
    unit: "s",
    better: "lower",
    decimals: 2,
    group: "Speed",
    min: 5.5,
    max: 10,
  },
  {
    key: "home_to_first",
    label: "Home to first",
    short: "H-1B",
    unit: "s",
    better: "lower",
    decimals: 2,
    group: "Speed",
    min: 3,
    max: 6,
  },
  {
    key: "squat_max",
    label: "Squat 1RM",
    short: "Squat",
    unit: "lb",
    better: "higher",
    decimals: 0,
    group: "Strength",
    min: 0,
    max: 1000,
  },
  {
    key: "deadlift_max",
    label: "Deadlift 1RM",
    short: "Deadlift",
    unit: "lb",
    better: "higher",
    decimals: 0,
    group: "Strength",
    min: 0,
    max: 1000,
  },
  {
    key: "bench_max",
    label: "Bench 1RM",
    short: "Bench",
    unit: "lb",
    better: "higher",
    decimals: 0,
    group: "Strength",
    min: 0,
    max: 700,
  },
  {
    key: "broad_jump",
    label: "Broad jump",
    short: "Broad",
    unit: "in",
    better: "higher",
    decimals: 0,
    group: "Power",
    min: 30,
    max: 160,
  },
  {
    key: "vertical",
    label: "Vertical jump",
    short: "Vert",
    unit: "in",
    better: "higher",
    decimals: 1,
    group: "Power",
    min: 5,
    max: 50,
  },
  {
    key: "bodyweight",
    label: "Bodyweight",
    short: "BW",
    unit: "lb",
    better: "higher",
    decimals: 0,
    group: "Body",
    min: 50,
    max: 400,
  },
  {
    key: "height_in",
    label: "Height",
    short: "Ht",
    unit: "in",
    better: "higher",
    decimals: 0,
    group: "Body",
    min: 36,
    max: 90,
  },
];

export const METRIC_BY_KEY = new Map(METRICS.map((m) => [m.key, m]));

/** Headline metrics shown on the roster overview. */
export const ROSTER_METRICS = ["fastball_velo", "exit_velo", "sixty_time"] as const;

export function formatMetric(key: string, value: number) {
  const m = METRIC_BY_KEY.get(key);
  if (!m) return String(value);
  if (key === "height_in") return `${Math.floor(value / 12)}'${Math.round(value % 12)}"`;
  return `${value.toFixed(m.decimals)}${m.unit === "in" || m.unit === "lb" ? ` ${m.unit}` : m.unit === "s" ? "s" : ` ${m.unit}`}`;
}

/** Coerce a raw assessment JSON blob into known numeric metrics. */
export function readMetrics(data: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!data || typeof data !== "object" || Array.isArray(data)) return out;
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (METRIC_BY_KEY.has(k) && typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}
