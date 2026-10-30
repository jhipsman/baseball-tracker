import type { Result } from "./engine";
import { FIELD_POSITIONS, type FieldPos } from "./defense";

export type Base = 1 | 2 | 3;
export type Bases = Partial<Record<Base, string>>;
export type Destination = Base | "home" | "out" | "no_run";
export type RunnerMove = { id: string; from: 0 | Base; to: Destination };
export type Contact = "ground" | "fly" | "line" | "bunt";
export type RunnerReason =
  "stolen_base" | "caught_stealing" | "wild_pitch" | "passed_ball" | "advance" | "out";
export type FieldLocation = { x: number; y: number };
export type PlayDetails = {
  version: 1;
  moves: RunnerMove[];
  contact?: Contact;
  location?: FieldLocation;
  /** Who fielded it, from where the scorer tapped. */
  fielder?: FieldPos;
  thirdOut?: "force" | "timing";
  reason?: RunnerReason;
  snapshot?: Bases;
};

const BASES: Base[] = [1, 2, 3];
const DESTINATIONS: Destination[] = [1, 2, 3, "home", "out", "no_run"];
const CONTACTS: Contact[] = ["ground", "fly", "line", "bunt"];
const REASONS: RunnerReason[] = [
  "stolen_base",
  "caught_stealing",
  "wild_pitch",
  "passed_ball",
  "advance",
  "out",
];
const BATTER_OUT = new Set<Result>(["K", "KL", "GO", "FO", "LO", "PO", "SAC", "SF", "DP"]);
const FORCED = new Set<Result>(["BB", "IBB", "HBP"]);
const MINIMUM: Partial<Record<Result, number>> = { "1B": 1, "2B": 2, "3B": 3, HR: 4, E: 1, FC: 1 };

export const baseLabel = (base: number) => ["At bat", "First", "Second", "Third"][base] ?? "Home";
export const opponentBatterId = (seq: number) => `opponent:${seq}`;
export const isContactResult = (result: Result) =>
  !["BB", "IBB", "HBP", "K", "KL"].includes(result);
export const runnerEntries = (bases: Bases) =>
  BASES.flatMap((base) => (bases[base] ? [{ id: bases[base]!, base }] : []));

export function parseBases(raw: unknown): Bases | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const result: Bases = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!["1", "2", "3"].includes(key) || typeof value !== "string" || !value || value.length > 96)
      return null;
    result[Number(key) as Base] = value;
  }
  if (new Set(Object.values(result)).size !== Object.values(result).length) return null;
  return result;
}

/** Boundary parser shared by stored rows and server action input. No inferred runner identities. */
export function parsePlayDetails(raw: unknown): PlayDetails | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.version !== 1 || !Array.isArray(r.moves) || r.moves.length > 4) return null;
  const moves: RunnerMove[] = [];
  for (const item of r.moves) {
    if (!item || typeof item !== "object") return null;
    const m = item as Record<string, unknown>;
    if (
      typeof m.id !== "string" ||
      !m.id ||
      m.id.length > 96 ||
      ![0, 1, 2, 3].includes(m.from as number) ||
      !DESTINATIONS.includes(m.to as Destination)
    )
      return null;
    moves.push({ id: m.id, from: m.from as RunnerMove["from"], to: m.to as Destination });
  }
  if (new Set(moves.map((m) => m.id)).size !== moves.length) return null;
  const details: PlayDetails = { version: 1, moves };
  if (r.contact !== undefined) {
    if (!CONTACTS.includes(r.contact as Contact)) return null;
    details.contact = r.contact as Contact;
  }
  if (r.location !== undefined) {
    if (!r.location || typeof r.location !== "object") return null;
    const p = r.location as Record<string, unknown>;
    if (
      typeof p.x !== "number" ||
      typeof p.y !== "number" ||
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y) ||
      p.x < 0 ||
      p.x > 1 ||
      p.y < 0 ||
      p.y > 1
    )
      return null;
    details.location = { x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 };
  }
  if (r.fielder !== undefined) {
    if (!FIELD_POSITIONS.includes(r.fielder as FieldPos)) return null;
    details.fielder = r.fielder as FieldPos;
  }
  if (r.thirdOut !== undefined) {
    if (r.thirdOut !== "force" && r.thirdOut !== "timing") return null;
    details.thirdOut = r.thirdOut;
  }
  if (r.reason !== undefined) {
    if (!REASONS.includes(r.reason as RunnerReason)) return null;
    details.reason = r.reason as RunnerReason;
  }
  if (r.snapshot !== undefined) {
    const snapshot = parseBases(r.snapshot);
    if (!snapshot) return null;
    details.snapshot = snapshot;
  }
  return details;
}

/** Conservative starting positions. Every non-forced runner can be resolved before saving. */
export function proposeMoves(bases: Bases, batterId: string, result: Result): RunnerMove[] {
  const moves: RunnerMove[] = runnerEntries(bases).map(({ id, base }) => ({
    id,
    from: base,
    to: base,
  }));
  if (FORCED.has(result)) {
    let force = true;
    for (const base of BASES) {
      const m = moves.find((move) => move.from === base);
      if (!m) {
        force = false;
        continue;
      }
      if (force) m.to = base === 3 ? "home" : ((base + 1) as Base);
    }
    return [...moves, { id: batterId, from: 0, to: 1 }];
  }
  if (["1B", "2B", "3B", "HR", "E", "FC"].includes(result)) {
    const advance = MINIMUM[result] ?? 1;
    for (const m of moves) m.to = m.from + advance >= 4 ? "home" : ((m.from + advance) as Base);
    if (result === "FC" && moves[0]) moves[0].to = "out";
    return [...moves, { id: batterId, from: 0, to: advance >= 4 ? "home" : (advance as Base) }];
  }
  if (result === "DP" && moves[0]) moves[0].to = "out";
  if (result === "SAC")
    for (const m of moves) m.to = m.from === 3 ? "home" : ((m.from + 1) as Base);
  if (result === "SF") for (const m of moves) if (m.from === 3) m.to = "home";
  return [...moves, { id: batterId, from: 0, to: "out" }];
}

export type ResolvedPlay = {
  bases: Bases;
  runs: number;
  outs: number;
  scored: string[];
  details: PlayDetails;
};

export function resolveRunnerPlay(input: {
  bases: Bases;
  batterId: string | null;
  result: Result | null;
  outsBefore: number;
  details: unknown;
}): ResolvedPlay | { error: string } {
  const details = parsePlayDetails(input.details);
  if (!details || details.snapshot) return { error: "Check the runner outcomes and try again." };
  const expected = runnerEntries(input.bases).map(({ id, base }) => ({ id, from: base as number }));
  if (input.batterId) {
    if (expected.some((r) => r.id === input.batterId))
      return { error: "The batter is already on base. Correct the bases or lineup first." };
    expected.push({ id: input.batterId, from: 0 });
  }
  if (
    details.moves.length !== expected.length ||
    expected.some((r) => !details.moves.some((m) => m.id === r.id && m.from === r.from))
  ) {
    return { error: "The runners have changed. Refresh and resolve this play again." };
  }
  const occupied = new Set<number>();
  const bases: Bases = {};
  for (const m of details.moves) {
    if (typeof m.to === "number") {
      if (m.to < m.from) return { error: "A runner cannot finish behind their starting base." };
      if (occupied.has(m.to)) return { error: "Two runners cannot occupy the same base." };
      occupied.add(m.to);
      bases[m.to] = m.id;
    }
  }
  const batter = details.moves.find((m) => m.from === 0);
  const result = input.result;
  if (result && FORCED.has(result)) {
    const forced = proposeMoves(input.bases, input.batterId!, result);
    if (
      forced.some((m) => !details.moves.some((actual) => actual.id === m.id && actual.to === m.to))
    )
      return { error: "On a walk or hit by pitch, use the forced runner advances." };
  }
  if (result && BATTER_OUT.has(result) && batter?.to !== "out")
    return { error: "This result records the batter out." };
  if (result && MINIMUM[result] && batter && batter.to !== "out") {
    const destination = batter.to === "home" ? 4 : typeof batter.to === "number" ? batter.to : 0;
    if (destination < MINIMUM[result]!)
      return { error: "The batter must reach the base credited by this result." };
  }
  if (result === "HR" && details.moves.some((m) => m.to !== "home"))
    return { error: "A home run scores the batter and all runners." };
  const outs = details.moves.filter((m) => m.to === "out").length;
  const minimumOuts =
    result === "DP" ? 2 : result === "FC" ? 1 : result && BATTER_OUT.has(result) ? 1 : 0;
  if (outs < minimumOuts)
    return { error: `Resolve ${minimumOuts} out${minimumOuts === 1 ? "" : "s"} for this result.` };
  if (outs + input.outsBefore > 3)
    return { error: "There are not enough outs remaining for this play." };
  const ending = outs + input.outsBefore === 3;
  if (!ending && details.moves.some((m) => m.to === "no_run"))
    return { error: "A no-run outcome is only available on the third out." };
  const home = details.moves.filter((m) => m.to === "home");
  if (ending && home.length && !details.thirdOut)
    return { error: "Confirm whether the third out was a force out or a timing play." };
  if (ending && home.length && details.thirdOut === "timing" && result && BATTER_OUT.has(result)) {
    return { error: "No run counts when this batter's out completes the half." };
  }
  const scored = ending && details.thirdOut === "force" ? [] : home.map((m) => m.id);
  return { bases: ending ? {} : bases, runs: scored.length, outs, scored, details };
}

export function defaultRbi(result: Result | null, runs: number) {
  return result && !["E", "FC", "DP", "K", "KL", "SB", "CS"].includes(result) ? runs : 0;
}

export function fieldZone(point: FieldLocation): string {
  if (point.y < 0.4)
    return point.x < 0.37 ? "Left field" : point.x > 0.63 ? "Right field" : "Center field";
  if (point.y > 0.8) return "Home plate";
  if (point.x < 0.32) return "Third base";
  if (point.x > 0.68) return "First base";
  if (point.y < 0.56) return point.x < 0.5 ? "Shortstop" : "Second base";
  return "Pitcher";
}
