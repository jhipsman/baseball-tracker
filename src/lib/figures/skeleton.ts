/**
 * A small 2D figure for exercise diagrams. Poses are absolute segment angles
 * (degrees from straight down, turning toward the way the figure faces), so
 * limbs never stretch and in-between frames are just blended angles.
 */

export type Limb = [upper: number, lower: number];
export type Pose = {
  /** Hip → neck. 180 is upright, 90 is lying forward (face toward +x). */
  torso: number;
  /** Arms and legs: [near, far]. */
  arm: [Limb, Limb];
  leg: [Limb, Limb];
  /** Foot direction for each leg (default 90: flat, pointing forward). */
  foot?: [number, number];
  /** Head tilt relative to the torso line (default 0). */
  head?: number;
  /**
   * Arm length on screen, 0–1 (default 1). Shorter = pointing toward the
   * viewer, for moves in the plane you can't see (pull-aparts, rotations).
   */
  reach?: [number, number];
};

export type View = "side" | "front";

export type Point = [number, number];
export type Joints = {
  hip: Point;
  neck: Point;
  /** Mid-shoulder (side view: the shoulder). */
  shoulder: Point;
  /** Each arm's shoulder and each leg's hip (apart in front view). */
  shoulders: [Point, Point];
  hips: [Point, Point];
  head: Point;
  elbow: [Point, Point];
  hand: [Point, Point];
  knee: [Point, Point];
  ankle: [Point, Point];
  toe: [Point, Point];
  /** Upper back, where a barbell sits on a back squat. */
  back: Point;
};

export const LEN = {
  torso: 26,
  neck: 4,
  head: 5.5,
  upper: 15,
  fore: 14,
  thigh: 20,
  shin: 20,
  foot: 6,
};

const rad = (d: number) => (d * Math.PI) / 180;
const step = ([x, y]: Point, angle: number, len: number): Point => [
  x + Math.sin(rad(angle)) * len,
  y + Math.cos(rad(angle)) * len,
];

/** Joint positions with the hip at the origin. Front view: near = figure's right (screen left). */
export function joints(p: Pose, view: View = "side"): Joints {
  const hip: Point = [0, 0];
  const neck = step(hip, p.torso, LEN.torso);
  const shoulder = step(hip, p.torso, LEN.torso - 2);
  const back = step(hip, p.torso, LEN.torso - 4);
  const head = step(neck, p.torso + (p.head ?? 0), LEN.neck + LEN.head);
  const w = view === "front" ? 7 : 0,
    hw = view === "front" ? 4.5 : 0;
  const shoulders: [Point, Point] = [
    [shoulder[0] - w, shoulder[1]],
    [shoulder[0] + w, shoulder[1]],
  ];
  const hips: [Point, Point] = [
    [hip[0] - hw, hip[1]],
    [hip[0] + hw, hip[1]],
  ];
  const r = p.reach ?? [1, 1];
  const elbow = p.arm.map((a, i) => step(shoulders[i], a[0], LEN.upper * r[i])) as [Point, Point];
  const hand = p.arm.map((a, i) => step(elbow[i], a[1], LEN.fore * r[i])) as [Point, Point];
  const knee = p.leg.map((l, i) => step(hips[i], l[0], LEN.thigh)) as [Point, Point];
  const ankle = p.leg.map((l, i) => step(knee[i], l[1], LEN.shin)) as [Point, Point];
  const toe = ankle.map((a, i) =>
    view === "front" ? step(a, i === 0 ? -90 : 90, 3) : step(a, p.foot?.[i] ?? 90, LEN.foot),
  ) as [Point, Point];
  return { hip, neck, shoulder, shoulders, hips, head, back, elbow, hand, knee, ankle, toe };
}

/** Shortest-way blend between two angles. */
const mixAngle = (a: number, b: number, t: number) => {
  let d = ((((b - a) % 360) + 540) % 360) - 180;
  if (Math.abs(d) === 180) d = b - a;
  return a + d * t;
};
const mixLimb = (a: Limb, b: Limb, t: number): Limb => [
  mixAngle(a[0], b[0], t),
  mixAngle(a[1], b[1], t),
];

export function mixPose(a: Pose, b: Pose, t: number): Pose {
  return {
    torso: mixAngle(a.torso, b.torso, t),
    head: mixAngle(a.head ?? 0, b.head ?? 0, t),
    arm: [mixLimb(a.arm[0], b.arm[0], t), mixLimb(a.arm[1], b.arm[1], t)],
    leg: [mixLimb(a.leg[0], b.leg[0], t), mixLimb(a.leg[1], b.leg[1], t)],
    foot: [
      mixAngle(a.foot?.[0] ?? 90, b.foot?.[0] ?? 90, t),
      mixAngle(a.foot?.[1] ?? 90, b.foot?.[1] ?? 90, t),
    ],
    reach: [
      (a.reach?.[0] ?? 1) + ((b.reach?.[0] ?? 1) - (a.reach?.[0] ?? 1)) * t,
      (a.reach?.[1] ?? 1) + ((b.reach?.[1] ?? 1) - (a.reach?.[1] ?? 1)) * t,
    ],
  };
}

/** Which part of the body stays put on screen while the rest moves. */
export type Anchor =
  | { on: "feet"; x: number } // lowest foot on the ground, feet centered at x
  | { on: "nearFoot" | "farFoot" | "hands" | "nearHand" | "hip" | "knees"; at: Point };

export const GROUND = 90;

export function place(j: Joints, anchor: Anchor): Joints {
  let target: Point, from: Point;
  const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  switch (anchor.on) {
    case "feet": {
      const low = Math.max(j.ankle[0][1], j.ankle[1][1], j.toe[0][1], j.toe[1][1]);
      from = [mid(j.ankle[0], j.ankle[1])[0], low];
      target = [anchor.x, GROUND - 1.5];
      break;
    }
    case "nearFoot":
      from = j.ankle[0];
      target = anchor.at;
      break;
    case "farFoot":
      from = j.ankle[1];
      target = anchor.at;
      break;
    case "hands":
      from = mid(j.hand[0], j.hand[1]);
      target = anchor.at;
      break;
    case "nearHand":
      from = j.hand[0];
      target = anchor.at;
      break;
    case "knees":
      from = mid(j.knee[0], j.knee[1]);
      target = anchor.at;
      break;
    default:
      from = j.hip;
      target = anchor.at;
  }
  const dx = target[0] - from[0],
    dy = target[1] - from[1];
  const mv = ([x, y]: Point): Point => [x + dx, y + dy];
  const two = (p: [Point, Point]) => [mv(p[0]), mv(p[1])] as [Point, Point];
  return {
    hip: mv(j.hip),
    neck: mv(j.neck),
    shoulder: mv(j.shoulder),
    shoulders: two(j.shoulders),
    hips: two(j.hips),
    head: mv(j.head),
    back: mv(j.back),
    elbow: two(j.elbow),
    hand: two(j.hand),
    knee: two(j.knee),
    ankle: two(j.ankle),
    toe: two(j.toe),
  };
}
