export type Pt = [number, number];

/** Interior angle at vertex b (degrees, 0–180) in pixel space. Points are normalized 0..1. */
export function angleAt(a: Pt, b: Pt, c: Pt, aspect = 1): number {
  const v1 = [(a[0] - b[0]) * aspect, a[1] - b[1]];
  const v2 = [(c[0] - b[0]) * aspect, c[1] - b[1]];
  const l1 = Math.hypot(v1[0], v1[1]);
  const l2 = Math.hypot(v2[0], v2[1]);
  if (l1 === 0 || l2 === 0) return 0;
  const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2);
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}

/** Angle of a line from horizontal (degrees, 0–90), e.g. shoulder tilt or arm slot. */
export function tiltOf(a: Pt, b: Pt, aspect = 1): number {
  const dx = Math.abs((b[0] - a[0]) * aspect);
  const dy = Math.abs(b[1] - a[1]);
  if (dx === 0 && dy === 0) return 0;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export function dist(a: Pt, b: Pt, aspect = 1): number {
  return Math.hypot((a[0] - b[0]) * aspect, a[1] - b[1]);
}

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Rounds normalized points to 4 decimals so stored shapes stay small. */
export function roundPts(points: Pt[]): Pt[] {
  return points.map(([x, y]) => [
    Math.round(clamp01(x) * 1e4) / 1e4,
    Math.round(clamp01(y) * 1e4) / 1e4,
  ]);
}

/** Drops freehand points closer than `min` to the previous kept point. */
export function simplify(points: Pt[], min = 0.004): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || dist(last, p) >= min) out.push(p);
  }
  const end = points[points.length - 1];
  if (end && out[out.length - 1] !== end) out.push(end);
  return out;
}

export function isVisibleAt(t: number, now: number, hold: number): boolean {
  return now >= t - 0.05 && now <= t + hold;
}

/** "1:05.3" style timestamp. */
export function formatClock(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(1).padStart(4, "0")}`;
}

/** `count` timestamps evenly spread across [start, end]; the last stays just before `end`. */
export function sampleTimes(start: number, end: number, count: number): number[] {
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.max(lo, Math.max(start, end) - 0.05);
  if (count <= 1 || hi - lo < 0.05) return [Math.round(lo * 100) / 100];
  return Array.from(
    { length: count },
    (_, i) => Math.round((lo + ((hi - lo) * i) / (count - 1)) * 100) / 100,
  );
}
