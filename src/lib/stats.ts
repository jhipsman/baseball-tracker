/**
 * Baseball stat math: totals, rate stats, innings-pitched handling, formatting
 * and box-score validation. Pure functions only (shared by server and client).
 *
 * Innings pitched are stored as outs (5.2 IP = 17 outs) so sums are exact.
 */

export const BATTING_FIELDS = [
  "ab",
  "r",
  "h",
  "doubles",
  "triples",
  "hr",
  "rbi",
  "bb",
  "so",
  "hbp",
  "sb",
  "cs",
  "sac",
  "sf",
  "e",
] as const;
export type BattingField = (typeof BATTING_FIELDS)[number];
export type BattingLine = Record<BattingField, number>;

export const PITCHING_FIELDS = ["outs", "h", "r", "er", "bb", "so", "hbp", "hr"] as const;
export type PitchingField = (typeof PITCHING_FIELDS)[number];
export type Decision = "W" | "L" | "S" | "H";
export const DECISIONS: readonly Decision[] = ["W", "L", "S", "H"];
export type PitchingLine = Record<PitchingField, number> & {
  pitches: number | null;
  strikes: number | null;
  decision: Decision | null;
};

export const BATTING_LABELS: Record<BattingField, string> = {
  ab: "AB",
  r: "R",
  h: "H",
  doubles: "2B",
  triples: "3B",
  hr: "HR",
  rbi: "RBI",
  bb: "BB",
  so: "SO",
  hbp: "HBP",
  sb: "SB",
  cs: "CS",
  sac: "SAC",
  sf: "SF",
  e: "E",
};

/** Upper bounds from the DB check constraints. */
export const BATTING_MAX: Record<BattingField, number> = {
  ab: 15,
  r: 15,
  h: 15,
  doubles: 15,
  triples: 15,
  hr: 15,
  rbi: 30,
  bb: 15,
  so: 15,
  hbp: 15,
  sb: 15,
  cs: 15,
  sac: 15,
  sf: 15,
  e: 15,
};
export const PITCHING_MAX = { outs: 90, other: 60, pitches: 250 } as const;

export const emptyBatting = (): BattingLine =>
  Object.fromEntries(BATTING_FIELDS.map((f) => [f, 0])) as BattingLine;

export const emptyPitching = (): PitchingLine => ({
  outs: 0,
  h: 0,
  r: 0,
  er: 0,
  bb: 0,
  so: 0,
  hbp: 0,
  hr: 0,
  pitches: null,
  strikes: null,
  decision: null,
});

// -----------------------------------------------------------------------------
// Batting
// -----------------------------------------------------------------------------

export type BattingTotals = BattingLine & { g: number };

export function sumBatting(lines: readonly BattingLine[]): BattingTotals {
  const t = { ...emptyBatting(), g: lines.length };
  for (const l of lines) for (const f of BATTING_FIELDS) t[f] += l[f] ?? 0;
  return t;
}

const ratio = (num: number, den: number) => (den > 0 ? num / den : null);

/** Singles + 2×2B + 3×3B + 4×HR. */
export const totalBases = (t: BattingLine) =>
  t.h - t.doubles - t.triples - t.hr + 2 * t.doubles + 3 * t.triples + 4 * t.hr;

/** Plate appearances: AB + BB + HBP + SAC + SF (catcher's interference not tracked). */
export const plateAppearances = (t: BattingLine) => t.ab + t.bb + t.hbp + t.sac + t.sf;

export type BattingRates = {
  pa: number;
  tb: number;
  avg: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
};

export function battingRates(t: BattingLine): BattingRates {
  const tb = totalBases(t);
  const avg = ratio(t.h, t.ab);
  const obp = ratio(t.h + t.bb + t.hbp, t.ab + t.bb + t.hbp + t.sf);
  const slg = ratio(tb, t.ab);
  return {
    pa: plateAppearances(t),
    tb,
    avg,
    obp,
    slg,
    ops: obp == null && slg == null ? null : (obp ?? 0) + (slg ?? 0),
  };
}

// -----------------------------------------------------------------------------
// Pitching
// -----------------------------------------------------------------------------

/** 17 → "5.2" (the digit after the dot is outs, not tenths). */
export function formatIP(outs: number) {
  const o = Math.max(0, Math.round(outs));
  return `${Math.floor(o / 3)}.${o % 3}`;
}

/** "5.2" → 17, "5" → 15, ".1" → 1. Returns null for anything else (e.g. "5.3", "abc"). */
export function parseIP(input: string): number | null {
  const s = input.trim();
  if (s === "") return 0;
  const m = /^(\d{0,2})(?:\.([0-2]))?$/.exec(s);
  if (!m || (m[1] === "" && m[2] === undefined)) return null;
  return Number(m[1] || 0) * 3 + Number(m[2] ?? 0);
}

export type PitchingTotals = Omit<PitchingLine, "pitches" | "strikes" | "decision"> & {
  app: number;
  pitches: number;
  strikes: number;
  /** Lines with a recorded pitch count (strike % uses only lines with both). */
  pitchedCounted: number;
  w: number;
  l: number;
  sv: number;
  hld: number;
};

export function sumPitching(lines: readonly PitchingLine[]): PitchingTotals {
  const t: PitchingTotals = {
    outs: 0,
    h: 0,
    r: 0,
    er: 0,
    bb: 0,
    so: 0,
    hbp: 0,
    hr: 0,
    app: lines.length,
    pitches: 0,
    strikes: 0,
    pitchedCounted: 0,
    w: 0,
    l: 0,
    sv: 0,
    hld: 0,
  };
  for (const l of lines) {
    for (const f of PITCHING_FIELDS) t[f] += l[f] ?? 0;
    if (l.pitches != null) {
      t.pitches += l.pitches;
      t.pitchedCounted += 1;
      if (l.strikes != null) t.strikes += l.strikes;
    }
    if (l.decision === "W") t.w += 1;
    if (l.decision === "L") t.l += 1;
    if (l.decision === "S") t.sv += 1;
    if (l.decision === "H") t.hld += 1;
  }
  return t;
}

/** Add up already-totalled pitching (e.g. per-player totals → team). */
export function combinePitching(ts: readonly PitchingTotals[]): PitchingTotals {
  const out = sumPitching([]);
  for (const t of ts) for (const k of Object.keys(out) as (keyof PitchingTotals)[]) out[k] += t[k];
  return out;
}

export type PitchingRates = {
  /** Innings in a regulation game the per-game rates are scaled to. */
  n: number;
  ip: number;
  era: number | null;
  whip: number | null;
  kPerN: number | null;
  bbPerN: number | null;
  kbb: number | null;
};

/**
 * ERA and K/N scale to N innings (a regulation game): 7 for most youth and
 * high-school ball, 9 for MLB. With 0 IP, ERA/WHIP are Infinity when runners
 * or earned runs were allowed, null when nothing happened.
 */
export function pitchingRates(t: PitchingTotals, n = 7): PitchingRates {
  const ip = t.outs / 3;
  const perInning = (x: number) => (ip > 0 ? x / ip : x > 0 ? Infinity : null);
  const era = perInning(t.er);
  const whip = perInning(t.bb + t.h);
  const k = perInning(t.so);
  const bb = perInning(t.bb);
  return {
    n,
    ip,
    era: era == null ? null : era * n,
    whip,
    kPerN: k == null ? null : k * n,
    bbPerN: bb == null ? null : bb * n,
    kbb: t.bb > 0 ? t.so / t.bb : null,
  };
}

/** Most common `innings_scheduled` among the games (ties → larger), default 7. */
export function regulationInnings(games: readonly { innings_scheduled: number }[], fallback = 7) {
  const counts = new Map<number, number>();
  for (const g of games)
    counts.set(g.innings_scheduled, (counts.get(g.innings_scheduled) ?? 0) + 1);
  let best = fallback;
  let bestCount = 0;
  for (const [inn, c] of counts) {
    if (c > bestCount || (c === bestCount && inn > best)) {
      best = inn;
      bestCount = c;
    }
  }
  return best;
}

export const eraLabel = (n: number) => `ERA (${n} inn)`;

// -----------------------------------------------------------------------------
// Formatting
// -----------------------------------------------------------------------------

export const NO_DATA = "—";

/** Batting-average style: ".333", "1.000", ".000", "—". */
export function fmtAvg(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return NO_DATA;
  const s = v.toFixed(3);
  return v < 1 ? s.replace(/^0/, "") : s;
}

/** Fixed decimals: ERA "3.50", WHIP "1.25". Infinity → "∞". */
export function fmtRate(v: number | null | undefined, digits = 2) {
  if (v == null || Number.isNaN(v)) return NO_DATA;
  if (!Number.isFinite(v)) return "∞";
  return v.toFixed(digits);
}

export const fmtPct = (num: number, den: number) =>
  den > 0 ? `${Math.round((num / den) * 100)}%` : NO_DATA;

// -----------------------------------------------------------------------------
// Qualification for rate-stat leaders
// -----------------------------------------------------------------------------

/** Youth-friendly minimums: 2 PA and 1 IP per team game. */
export function qualifiers(teamGames: number) {
  return { minPA: 2 * teamGames, minOuts: 3 * teamGames };
}

// -----------------------------------------------------------------------------
// Validation (mirrors the DB checks, plus sanity warnings)
// -----------------------------------------------------------------------------

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

const badInt = (v: number, max: number) => !Number.isInteger(v) || v < 0 || v > max;

export function validateBatting(l: BattingLine): FieldErrors<BattingField> {
  const e: FieldErrors<BattingField> = {};
  for (const f of BATTING_FIELDS) {
    if (badInt(l[f], BATTING_MAX[f])) e[f] = `${BATTING_LABELS[f]} must be 0–${BATTING_MAX[f]}.`;
  }
  if (!e.h && !e.ab && l.h > l.ab) e.h = "More hits than at-bats.";
  if (!e.so && !e.ab && l.so > l.ab) e.so = "More strikeouts than at-bats.";
  if (!e.ab && !e.h && !e.so && l.h + l.so > l.ab) e.so = "Hits + strikeouts exceed at-bats.";
  const xbh = l.doubles + l.triples + l.hr;
  if (!e.h && xbh > l.h) {
    const f = l.hr > 0 ? "hr" : l.triples > 0 ? "triples" : "doubles";
    e[f] = "2B + 3B + HR can't exceed hits.";
  }
  return e;
}

/** Things that are almost always typos but not impossible enough to block. */
export function battingWarnings(l: BattingLine): string[] {
  const w: string[] = [];
  if (l.hr > l.r) w.push("Every home run is also a run scored (R < HR).");
  if (l.hr > l.rbi) w.push("Every home run drives in at least the batter (RBI < HR).");
  return w;
}

export type PitchingErrorKey = PitchingField | "pitches" | "strikes" | "ip";

export function validatePitching(l: PitchingLine): FieldErrors<PitchingErrorKey> {
  const e: FieldErrors<PitchingErrorKey> = {};
  if (badInt(l.outs, PITCHING_MAX.outs)) e.ip = "IP must be between 0 and 30.";
  for (const f of PITCHING_FIELDS) {
    if (f !== "outs" && badInt(l[f], PITCHING_MAX.other))
      e[f] = `${f.toUpperCase()} must be 0–${PITCHING_MAX.other}.`;
  }
  if (l.pitches != null && badInt(l.pitches, PITCHING_MAX.pitches))
    e.pitches = `Pitches must be 0–${PITCHING_MAX.pitches}.`;
  if (l.strikes != null && badInt(l.strikes, PITCHING_MAX.pitches))
    e.strikes = `Strikes must be 0–${PITCHING_MAX.pitches}.`;
  if (!e.er && !e.r && l.er > l.r) e.er = "Earned runs can't exceed runs.";
  if (!e.hr && !e.h && l.hr > l.h) e.hr = "Home runs can't exceed hits.";
  if (!e.strikes && !e.pitches && l.strikes != null && l.pitches != null && l.strikes > l.pitches)
    e.strikes = "Strikes can't exceed pitches.";
  return e;
}

export type BoxScoreInput = {
  batting: (BattingLine & { player_id: string; batting_order: number | null })[];
  pitching: (PitchingLine & { player_id: string })[];
  teamScore?: number | null;
  opponentScore?: number | null;
};

export type BoxScoreCheck = {
  ok: boolean;
  batting: FieldErrors<BattingField>[];
  pitching: FieldErrors<PitchingErrorKey>[];
  /** Errors that aren't tied to one cell. */
  errors: string[];
  warnings: string[];
};

/** Validate a whole box score. Errors block saving; warnings only inform. */
export function validateBoxScore(box: BoxScoreInput): BoxScoreCheck {
  const batting = box.batting.map(validateBatting);
  const pitching = box.pitching.map(validatePitching);
  const errors: string[] = [];
  const warnings: string[] = [];

  const ids = [...box.batting.map((b) => b.player_id), ...box.pitching.map((p) => p.player_id)];
  const seenB = new Set<string>();
  for (const b of box.batting) {
    if (seenB.has(b.player_id)) errors.push("A player is listed twice in the batting lineup.");
    seenB.add(b.player_id);
  }
  const seenP = new Set<string>();
  for (const p of box.pitching) {
    if (seenP.has(p.player_id)) errors.push("A pitcher is listed twice.");
    seenP.add(p.player_id);
  }
  if (ids.some((id) => !id)) errors.push("Every row needs a player.");

  for (const b of box.batting) {
    if (
      b.batting_order != null &&
      (!Number.isInteger(b.batting_order) || b.batting_order < 1 || b.batting_order > 30)
    )
      errors.push("Batting order must be 1–30.");
  }
  const orders = box.batting.map((b) => b.batting_order).filter((o) => o != null);
  if (new Set(orders).size !== orders.length)
    warnings.push("Two batters share a batting-order spot (fine for subs, otherwise check it).");

  for (const b of box.batting) warnings.push(...battingWarnings(b));

  const dec = (d: Decision) => box.pitching.filter((p) => p.decision === d).length;
  if (dec("W") > 1) errors.push("Only one pitcher can get the win.");
  if (dec("L") > 1) errors.push("Only one pitcher can get the loss.");
  if (dec("S") > 1) errors.push("Only one pitcher can get the save.");
  if (dec("W") && dec("L")) errors.push("A team can't have both the winning and losing pitcher.");

  const runs = box.batting.reduce((n, b) => n + b.r, 0);
  if (box.batting.length > 0 && box.teamScore != null && runs !== box.teamScore)
    warnings.push(`Batters' runs add up to ${runs}, but the final score says ${box.teamScore}.`);
  const allowed = box.pitching.reduce((n, p) => n + p.r, 0);
  if (box.pitching.length > 0 && box.opponentScore != null && allowed !== box.opponentScore)
    warnings.push(
      `Pitchers' runs allowed add up to ${allowed}, but the opponent scored ${box.opponentScore}.`,
    );
  if (box.teamScore != null && box.opponentScore != null) {
    if (dec("W") && box.teamScore <= box.opponentScore)
      warnings.push("A pitcher has the win, but the score isn't a win.");
    if (dec("L") && box.teamScore >= box.opponentScore)
      warnings.push("A pitcher has the loss, but the score isn't a loss.");
  }

  const ok =
    errors.length === 0 &&
    batting.every((e) => Object.keys(e).length === 0) &&
    pitching.every((e) => Object.keys(e).length === 0);
  return { ok, batting, pitching, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

/** Newspaper-style footnote: "2B: Smith 2, Jones. HR: Lee." */
export function boxFootnotes(
  rows: readonly (Pick<BattingLine, "doubles" | "triples" | "hr" | "sb" | "e"> & {
    name: string;
  })[],
) {
  const parts: { label: string; text: string }[] = [];
  const add = (label: string, key: "doubles" | "triples" | "hr" | "sb" | "e") => {
    const who = rows
      .filter((r) => r[key] > 0)
      .map((r) => (r[key] > 1 ? `${r.name} ${r[key]}` : r.name));
    if (who.length) parts.push({ label, text: who.join(", ") });
  };
  add("2B", "doubles");
  add("3B", "triples");
  add("HR", "hr");
  add("SB", "sb");
  add("E", "e");
  return parts;
}

/** Short name for box scores: "J. Smith" (or the email name). */
export function boxName(full: string | null | undefined, email?: string | null) {
  const n = (full ?? "").trim();
  if (!n) return (email ?? "").split("@")[0] || "Player";
  const parts = n.split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : n;
}

export type PlayerSeason = {
  playerId: string;
  bat: BattingTotals | null;
  pit: PitchingTotals | null;
};

/** Group lines by player and total them (players with no lines of a kind get null). */
export function seasonByPlayer(
  batting: readonly (BattingLine & { playerId: string })[],
  pitching: readonly (PitchingLine & { playerId: string })[],
): PlayerSeason[] {
  const bats = new Map<string, BattingLine[]>();
  const pits = new Map<string, PitchingLine[]>();
  for (const b of batting) bats.set(b.playerId, [...(bats.get(b.playerId) ?? []), b]);
  for (const p of pitching) pits.set(p.playerId, [...(pits.get(p.playerId) ?? []), p]);
  const ids = new Set([...bats.keys(), ...pits.keys()]);
  return [...ids].map((playerId) => ({
    playerId,
    bat: bats.has(playerId) ? sumBatting(bats.get(playerId)!) : null,
    pit: pits.has(playerId) ? sumPitching(pits.get(playerId)!) : null,
  }));
}

/** A one-line game summary:"2-for-3, HR, 2 RBI, BB" / "4.2 IP, 3 H, 1 ER, 6 K". */
export function battingSummary(l: BattingLine) {
  const bits = [`${l.h}-for-${l.ab}`];
  const n = (v: number, s: string) => (v > 1 ? `${v} ${s}` : v === 1 ? s : null);
  for (const b of [
    n(l.doubles, "2B"),
    n(l.triples, "3B"),
    n(l.hr, "HR"),
    n(l.r, "R"),
    n(l.rbi, "RBI"),
    n(l.bb, "BB"),
    n(l.hbp, "HBP"),
    n(l.so, "K"),
    n(l.sb, "SB"),
  ])
    if (b) bits.push(b);
  return bits.join(", ");
}

export function pitchingSummary(l: PitchingLine) {
  const bits = [`${formatIP(l.outs)} IP`, `${l.h} H`, `${l.er} ER`, `${l.bb} BB`, `${l.so} K`];
  if (l.pitches != null) bits.push(`${l.pitches} P`);
  if (l.decision) bits.unshift(l.decision);
  return bits.join(", ");
}
