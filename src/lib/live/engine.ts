/**
 * Live game log engine (pure). The play list is the source of truth: the
 * situation (inning, outs, batter up), line score, and box score are all
 * derived from it, so undo is just dropping the last play.
 */

export type Half = "top" | "bottom";
export type PlayKind = "pa" | "steal" | "sub" | "half_end";
export type Result =
  | "1B"
  | "2B"
  | "3B"
  | "HR"
  | "BB"
  | "IBB"
  | "HBP"
  | "K"
  | "KL"
  | "GO"
  | "FO"
  | "LO"
  | "PO"
  | "E"
  | "FC"
  | "SAC"
  | "SF"
  | "DP"
  | "SB"
  | "CS";

export type Play = {
  seq: number;
  inning: number;
  half: Half;
  weBat: boolean;
  kind: PlayKind;
  batterId: string | null;
  pitcherId: string | null;
  slot: number | null;
  result: Result | null;
  rbi: number;
  runs: number;
  unearned: number;
  scored: string[];
  pitches: number;
  outs: number;
};

/** Scorer setup plus the in-progress count (stored in games.live_state). */
export type LiveSetup = {
  lineup: string[];
  pitcherId: string | null;
  weBatFirst: boolean;
  balls: number;
  strikes: number;
  pitches: number;
};

export const PA_RESULTS: { key: Result; label: string; long: string }[] = [
  { key: "1B", label: "1B", long: "single" },
  { key: "2B", label: "2B", long: "double" },
  { key: "3B", label: "3B", long: "triple" },
  { key: "HR", label: "HR", long: "home run" },
  { key: "BB", label: "BB", long: "walk" },
  { key: "HBP", label: "HBP", long: "hit by pitch" },
  { key: "K", label: "K", long: "strikeout swinging" },
  { key: "KL", label: "Ꝁ", long: "strikeout looking" },
  { key: "GO", label: "GO", long: "ground out" },
  { key: "FO", label: "FO", long: "fly out" },
  { key: "LO", label: "LO", long: "line out" },
  { key: "PO", label: "PO", long: "pop out" },
  { key: "E", label: "E", long: "reached on error" },
  { key: "FC", label: "FC", long: "fielder's choice" },
  { key: "SAC", label: "SAC", long: "sacrifice bunt" },
  { key: "SF", label: "SF", long: "sacrifice fly" },
  { key: "DP", label: "DP", long: "double play" },
  { key: "IBB", label: "IBB", long: "intentional walk" },
];

const OUTS: Partial<Record<Result, number>> = {
  K: 1,
  KL: 1,
  GO: 1,
  FO: 1,
  LO: 1,
  PO: 1,
  FC: 1,
  SAC: 1,
  SF: 1,
  DP: 2,
  CS: 1,
};
const HITS = new Set<Result>(["1B", "2B", "3B", "HR"]);
const NOT_AB = new Set<Result>(["BB", "IBB", "HBP", "SAC", "SF"]);

/** Outs a result records on its own (extra outs on the bases are added by the scorer). */
export const outsFor = (r: Result | null) => (r ? (OUTS[r] ?? 0) : 0);

export function emptySetup(lineup: string[], pitcherId: string | null, weBatFirst: boolean) {
  return { lineup, pitcherId, weBatFirst, balls: 0, strikes: 0, pitches: 0 } as LiveSetup;
}

export type Situation = {
  inning: number;
  half: Half;
  weBat: boolean;
  outs: number;
  /** Index into `lineup` of our next batter. */
  batterIdx: number;
  lineup: string[];
  pitcherId: string | null;
  us: number;
  them: number;
  lineScore: { us: number; them: number }[];
};

export function situation(setup: LiveSetup, plays: Play[]): Situation {
  const s: Situation = {
    inning: 1,
    half: "top",
    weBat: setup.weBatFirst,
    outs: 0,
    batterIdx: 0,
    lineup: [...setup.lineup],
    pitcherId: setup.pitcherId,
    us: 0,
    them: 0,
    lineScore: [{ us: 0, them: 0 }],
  };
  const ordered = [...plays].sort((a, b) => a.seq - b.seq);
  for (const p of ordered) {
    if (p.kind === "sub") {
      if (p.slot && p.batterId && p.slot <= s.lineup.length) s.lineup[p.slot - 1] = p.batterId;
      else if (p.pitcherId) s.pitcherId = p.pitcherId;
      continue;
    }
    if (p.kind === "pa" && p.weBat && s.lineup.length) {
      s.batterIdx = (s.batterIdx + 1) % s.lineup.length;
    }
    const row = s.lineScore[s.inning - 1];
    if (p.runs) {
      if (p.weBat) {
        row.us += p.runs;
        s.us += p.runs;
      } else {
        row.them += p.runs;
        s.them += p.runs;
      }
    }
    s.outs = p.kind === "half_end" ? 3 : s.outs + p.outs;
    if (s.outs >= 3) {
      s.outs = 0;
      s.weBat = !s.weBat;
      if (s.half === "top") s.half = "bottom";
      else {
        s.half = "top";
        s.inning += 1;
        s.lineScore.push({ us: 0, them: 0 });
      }
    }
  }
  return s;
}

/** Batter due up for us, or null when we're in the field. */
export const batterUp = (s: Situation) =>
  s.weBat && s.lineup.length ? s.lineup[s.batterIdx] : null;

export type BattingLine = {
  player_id: string;
  batting_order: number | null;
  ab: number;
  r: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  rbi: number;
  bb: number;
  so: number;
  hbp: number;
  sb: number;
  cs: number;
  sac: number;
  sf: number;
};

export type PitchingLine = {
  player_id: string;
  outs: number;
  h: number;
  r: number;
  er: number;
  bb: number;
  so: number;
  hbp: number;
  hr: number;
  pitches: number;
};

/** Box score lines derived from the log (plus the in-progress pitch count, if any). */
export function deriveBox(setup: LiveSetup, plays: Play[], inProgressPitches = 0) {
  const ordered = [...plays].sort((a, b) => a.seq - b.seq);
  const batting = new Map<string, BattingLine>();
  const bat = (id: string) => {
    let l = batting.get(id);
    if (!l) {
      const slot = setup.lineup.indexOf(id);
      l = {
        player_id: id,
        batting_order: slot >= 0 ? slot + 1 : null,
        ab: 0,
        r: 0,
        h: 0,
        doubles: 0,
        triples: 0,
        hr: 0,
        rbi: 0,
        bb: 0,
        so: 0,
        hbp: 0,
        sb: 0,
        cs: 0,
        sac: 0,
        sf: 0,
      };
      batting.set(id, l);
    }
    return l;
  };
  setup.lineup.forEach((id) => bat(id));

  const pitching = new Map<string, PitchingLine>();
  const pit = (id: string) => {
    let l = pitching.get(id);
    if (!l) {
      l = { player_id: id, outs: 0, h: 0, r: 0, er: 0, bb: 0, so: 0, hbp: 0, hr: 0, pitches: 0 };
      pitching.set(id, l);
    }
    return l;
  };
  if (setup.pitcherId) pit(setup.pitcherId);

  for (const p of ordered) {
    if (p.kind === "sub") {
      if (p.slot && p.batterId) {
        const l = bat(p.batterId);
        l.batting_order ??= p.slot;
      } else if (p.pitcherId) pit(p.pitcherId);
      continue;
    }
    if (p.weBat) {
      for (const id of p.scored) bat(id).r += 1;
      if (!p.batterId) continue;
      const l = bat(p.batterId);
      if (p.kind === "steal") {
        if (p.result === "SB") l.sb += 1;
        if (p.result === "CS") l.cs += 1;
        continue;
      }
      if (p.kind !== "pa" || !p.result) continue;
      const r = p.result;
      if (!NOT_AB.has(r)) l.ab += 1;
      if (HITS.has(r)) l.h += 1;
      if (r === "2B") l.doubles += 1;
      if (r === "3B") l.triples += 1;
      if (r === "HR") l.hr += 1;
      if (r === "BB" || r === "IBB") l.bb += 1;
      if (r === "K" || r === "KL") l.so += 1;
      if (r === "HBP") l.hbp += 1;
      if (r === "SAC") l.sac += 1;
      if (r === "SF") l.sf += 1;
      l.rbi += p.rbi;
    } else if (p.pitcherId) {
      const l = pit(p.pitcherId);
      l.outs += p.kind === "half_end" ? 0 : p.outs;
      l.r += p.runs;
      l.er += p.runs - p.unearned;
      l.pitches += p.pitches;
      if (p.kind !== "pa" || !p.result) continue;
      const r = p.result;
      if (HITS.has(r)) l.h += 1;
      if (r === "HR") l.hr += 1;
      if (r === "BB" || r === "IBB") l.bb += 1;
      if (r === "K" || r === "KL") l.so += 1;
      if (r === "HBP") l.hbp += 1;
    }
  }

  // Outs from a quick-closed half go to whoever was pitching then.
  const sit = { outs: 0, half: "top" as Half, weBat: setup.weBatFirst, pitcherId: setup.pitcherId };
  for (const p of ordered) {
    if (p.kind === "sub") {
      if (!p.slot && p.pitcherId) sit.pitcherId = p.pitcherId;
      continue;
    }
    if (p.kind === "half_end" && !p.weBat && sit.pitcherId) {
      pit(sit.pitcherId).outs += Math.max(0, 3 - sit.outs);
    }
    sit.outs = p.kind === "half_end" ? 3 : sit.outs + p.outs;
    if (sit.outs >= 3) sit.outs = 0;
  }

  const current = situation(setup, plays).pitcherId;
  if (current && inProgressPitches) pit(current).pitches += inProgressPitches;

  return { batting: [...batting.values()], pitching: [...pitching.values()] };
}

/** Pitches thrown so far by a pitcher in this game (including the current at-bat). */
export function pitchCount(setup: LiveSetup, plays: Play[], pitcherId: string) {
  const fromPlays = plays
    .filter((p) => !p.weBat && p.pitcherId === pitcherId)
    .reduce((n, p) => n + p.pitches, 0);
  const current = situation(setup, plays).pitcherId;
  return fromPlays + (current === pitcherId ? setup.pitches : 0);
}

export const halfLabel = (s: { half: Half; inning: number }) =>
  `${s.half === "top" ? "Top" : "Bottom"} ${s.inning}`;

const LONG = Object.fromEntries(PA_RESULTS.map((r) => [r.key, r.long])) as Record<Result, string>;

/** One-line description of a play for the live feed. */
export function describePlay(p: Play, name: (id: string | null) => string) {
  const runs = p.runs ? ` · ${p.runs} run${p.runs === 1 ? "" : "s"} scored` : "";
  if (p.kind === "sub") {
    if (p.slot && p.batterId) return `Lineup: ${name(p.batterId)} now bats ${ordinal(p.slot)}`;
    return `Pitching change: ${name(p.pitcherId)} now pitching`;
  }
  if (p.kind === "half_end") {
    return `${p.weBat ? "We" : "They"} scored ${p.runs} · side retired`;
  }
  if (p.kind === "steal") {
    return p.result === "CS"
      ? `${name(p.batterId)} caught stealing`
      : `${name(p.batterId)} stole a base`;
  }
  const what = p.result ? LONG[p.result] : "plate appearance";
  if (p.weBat) {
    const rbi = p.rbi ? ` · ${p.rbi} RBI` : "";
    return `${name(p.batterId)}: ${what}${rbi}${runs}`;
  }
  const pc = p.pitches ? ` (${p.pitches} pitch${p.pitches === 1 ? "" : "es"})` : "";
  return `Their batter: ${what}${pc}${runs}`;
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Pitch Smart status for a pitcher during a game. */
export function pitchSmartLive(
  pitches: number,
  band: { dailyMax: number; restThresholds: readonly number[] } | null,
) {
  if (!band) return null;
  const t = band.restThresholds;
  const idx = t.findIndex((max) => pitches <= max);
  const restNow = idx === -1 ? 4 : idx;
  const nextLine = idx === -1 ? null : t[idx];
  return {
    pitches,
    left: Math.max(0, band.dailyMax - pitches),
    restNow,
    /** Pitches until rest goes up by a day (null once at the 4-day level). */
    untilMoreRest: nextLine == null ? null : nextLine - pitches + 1,
    restAfterNext: nextLine == null ? 4 : restNow + 1,
    over: pitches > band.dailyMax,
  };
}
