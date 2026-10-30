/** Who is playing where, and who the opponent sends up. Pure helpers for the live scorer. */
import type { LiveSetup, Play } from "./engine";

export const FIELD_POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"] as const;
export type FieldPos = (typeof FIELD_POSITIONS)[number];
export type Defense = Partial<Record<FieldPos, string>>;

export const FIELD_POS_LONG: Record<FieldPos, string> = {
  P: "pitcher",
  C: "catcher",
  "1B": "first",
  "2B": "second",
  "3B": "third",
  SS: "short",
  LF: "left",
  CF: "center",
  RF: "right",
};

/** Roster position → the field spots it can fill, in order of preference. */
const FITS: Record<string, FieldPos[]> = {
  P: ["P"],
  C: ["C"],
  "1B": ["1B"],
  "2B": ["2B"],
  SS: ["SS"],
  "3B": ["3B"],
  OF: ["CF", "LF", "RF"],
};

/** Where a player with this roster position would go first. */
export const preferredSpots = (position: string | null | undefined) => FITS[position ?? ""] ?? [];

/**
 * Fill the nine spots from the lineup: the starting pitcher pitches, players
 * take their roster position when it's free, and everyone else fills what's left.
 */
export function defaultDefense(
  lineup: string[],
  pitcherId: string | null,
  positionOf: (id: string) => string | null | undefined,
): Defense {
  const d: Defense = {};
  const used = new Set<string>();
  const put = (pos: FieldPos, id: string) => {
    d[pos] = id;
    used.add(id);
  };
  if (pitcherId) put("P", pitcherId);
  for (const id of lineup) {
    if (used.has(id)) continue;
    const spot = (FITS[positionOf(id) ?? ""] ?? []).find((p) => !d[p]);
    if (spot) put(spot, id);
  }
  // The mound is only for a pitcher: the starter, or someone listed as one.
  for (const pos of FIELD_POSITIONS) {
    if (d[pos] || pos === "P") continue;
    const id = lineup.find((x) => !used.has(x));
    if (id) put(pos, id);
  }
  return d;
}

/** Nearest fielder to a tap on the field (coordinates are 0–1 of the field image). */
const SPOTS: Record<FieldPos, [number, number]> = {
  LF: [0.27, 0.32],
  CF: [0.5, 0.23],
  RF: [0.73, 0.32],
  SS: [0.41, 0.5],
  "2B": [0.6, 0.5],
  "3B": [0.26, 0.67],
  "1B": [0.74, 0.67],
  P: [0.5, 0.66],
  C: [0.5, 0.94],
};
export function nearestFielder(x: number, y: number): FieldPos {
  let best: FieldPos = "P";
  let dist = Infinity;
  for (const pos of FIELD_POSITIONS) {
    const [px, py] = SPOTS[pos];
    const d = (px - x) ** 2 + (py - y) ** 2;
    if (d < dist) {
      best = pos;
      dist = d;
    }
  }
  return best;
}

export const opponentLabel = (setup: Pick<LiveSetup, "oppLineup"> | null, slot: number) =>
  setup?.oppLineup?.[slot]?.trim() || `Batter ${slot + 1}`;

/** Their lineup spot for each of their plate appearances, and who is up next. */
export function opponentOrder(setup: Pick<LiveSetup, "oppLineup"> | null, plays: Play[]) {
  const size = Math.max(1, setup?.oppLineup?.length || 9);
  const slots = new Map<number, number>();
  let n = 0;
  for (const p of plays) {
    if (p.kind === "pa" && !p.weBat) {
      slots.set(p.seq, n % size);
      n++;
    }
  }
  return { slots, next: n % size, size };
}
