import type { BuilderItem } from "./types";

/** "3 × 8 · @ 75% · rest 90s" */
export function summarize(item: BuilderItem) {
  const parts: string[] = [];
  if (item.sets != null || item.reps) {
    parts.push([item.sets ?? "–", item.reps || "–"].join(" × "));
  }
  if (item.intensity) parts.push(`@ ${item.intensity}`);
  if (item.tempo) parts.push(`tempo ${item.tempo}`);
  if (item.restSeconds != null) parts.push(`rest ${formatRest(item.restSeconds)}`);
  return parts.join(" · ");
}

function formatRest(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}:${String(s).padStart(2, "0")}` : `${m}m`;
}
