import type { TrackingType } from "@/constants";
import type { BuilderItem } from "./types";

/**
 * The "reps" column is free text, so for timed work a bare number reads as seconds:
 * a time exercise prescribed "30" shows as "30 s". Distances ("60 yd") pass through.
 */
export function prescribedReps(reps: string, tracking: TrackingType = "weight_reps") {
  const r = reps.trim();
  if (tracking === "time" && /^\d+(\.\d+)?$/.test(r)) return `${r} s`;
  return r;
}

/** "3 × 8 · @ 75% · rest 90s", "4 × 60 yd · rest 2m", "3 × 30 s" */
export function summarize(item: BuilderItem, tracking: TrackingType = "weight_reps") {
  const parts: string[] = [];
  if (item.sets != null || item.reps) {
    parts.push([item.sets ?? "–", prescribedReps(item.reps, tracking) || "–"].join(" × "));
  }
  if (item.intensity) parts.push(`@ ${item.intensity}`);
  if (item.tempo) parts.push(`tempo ${item.tempo}`);
  if (item.restSeconds != null) parts.push(`rest ${formatRest(item.restSeconds)}`);
  return parts.join(" · ");
}

/** What a freshly added exercise is prescribed (sets default to 3). */
export const DEFAULT_REPS: Record<TrackingType, string> = {
  weight_reps: "8",
  reps: "10",
  time: "",
  distance: "",
  distance_time: "",
};

/** Label + placeholder for the builder's "reps" input, per tracking type. */
export const REPS_FIELD: Record<TrackingType, { label: string; placeholder: string }> = {
  weight_reps: { label: "Reps", placeholder: "8, 8-10, AMRAP" },
  reps: { label: "Reps", placeholder: "10, 15, AMRAP" },
  time: { label: "Distance / time", placeholder: "60 yd, 30 (sec)" },
  distance: { label: "Distance", placeholder: "40 yd, 100 ft" },
  distance_time: { label: "Distance", placeholder: "60 yd, 500 m" },
};

function formatRest(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}:${String(s).padStart(2, "0")}` : `${m}m`;
}
