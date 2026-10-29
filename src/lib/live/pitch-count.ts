import type { LiveSetup, PitchSnapshot, Result } from "./engine";

export const MAX_AT_BAT_PITCHES = 40;

export type PitchKind =
  | "ball"
  | "called"
  | "swinging"
  | "foul"
  | "foul_bunt"
  | "foul_tip"
  | "in_play"
  | "plus"
  | "minus"
  | "reset";

const KINDS = new Set<PitchKind>([
  "ball",
  "called",
  "swinging",
  "foul",
  "foul_bunt",
  "foul_tip",
  "in_play",
  "plus",
  "minus",
  "reset",
]);

/** Old games have no history; discard malformed snapshots rather than inventing a count. */
export function parsePitchHistory(value: unknown): PitchSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-MAX_AT_BAT_PITCHES).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const { balls, strikes, pitches } = raw;
    if (
      !Number.isInteger(balls) ||
      balls < 0 ||
      balls > 3 ||
      !Number.isInteger(strikes) ||
      strikes < 0 ||
      strikes > 2 ||
      !Number.isInteger(pitches) ||
      pitches < 0 ||
      pitches >= MAX_AT_BAT_PITCHES
    )
      return [];
    return [{ balls, strikes, pitches }];
  });
}

/** A pitch changes the count and workload independently; completing the PA is the caller's job. */
export function updatePitchCount(
  setup: LiveSetup,
  kind: unknown,
): { live: LiveSetup; auto?: Result } | { error: string } {
  if (typeof kind !== "string" || !KINDS.has(kind as PitchKind)) {
    return { error: "Choose a pitch result." };
  }
  const history = parsePitchHistory(setup.pitchHistory);
  const live: LiveSetup = { ...setup, pitchHistory: history };
  if (kind === "reset") {
    return { live: { ...live, balls: 0, strikes: 0, pitchHistory: [] } };
  }
  if (kind === "minus") {
    const previous = history.at(-1);
    return {
      live: previous
        ? { ...live, ...previous, pitchHistory: history.slice(0, -1) }
        : { ...live, pitches: Math.max(0, live.pitches - 1) },
    };
  }
  if (live.pitches >= MAX_AT_BAT_PITCHES) {
    return { error: "This at-bat has 40 pitches. Record its result before adding more." };
  }
  live.pitchHistory = [
    ...history,
    { balls: live.balls, strikes: live.strikes, pitches: live.pitches },
  ];
  live.pitches += 1;
  if (kind === "ball") {
    if (live.balls === 3) return { live, auto: "BB" };
    live.balls += 1;
  } else if (["called", "swinging", "foul_bunt", "foul_tip"].includes(kind)) {
    if (live.strikes === 2) return { live, auto: kind === "called" ? "KL" : "K" };
    live.strikes += 1;
  } else if (kind === "foul") {
    live.strikes = Math.min(2, live.strikes + 1);
  }
  // In play and unclassified pitches count toward workload while awaiting a PA result.
  return { live };
}
