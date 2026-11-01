/**
 * Everything the live game view needs, in one JSON-safe object: the score bar,
 * who is on which base, the current at-bat pitch by pitch, the play-by-play
 * with big moments tagged, and every ball put in play with a location.
 * Pure (no data access) so it can be unit tested; see loadLiveSnapshot.
 */
import { FIELD_POSITIONS, opponentLabel, opponentOrder, type FieldPos } from "./defense";
import {
  describePlay,
  halfLabel,
  NOT_AB,
  pitchCount,
  situation,
  type Half,
  type LiveSetup,
  type PitchSnapshot,
  type Play,
  type Result,
} from "./engine";
import type { Base } from "./runners";

export type RunnerDot = { id: string; initials: string; name: string; ours: boolean };
export type FeedTag = "hr" | "hit" | "run" | "k" | "out" | "walk" | null;
export type FeedItem = {
  seq: number;
  when: string;
  text: string;
  tag: FeedTag;
  runs: number;
  weBat: boolean;
};
export type PitchChip = { n: number; label: "Ball" | "Strike" | "Foul"; count: string };
/** A runner who crossed the plate on the latest play, and the base they ran from (0 = batter). */
export type ScoredRunner = RunnerDot & { from: 0 | Base };
/** A fielder's spot on the viewer's field: our players' initials, or a dim dot for theirs. */
export type FielderDot = { pos: FieldPos; initials: string | null; ours: boolean };
export type BattedBall = { seq: number; x: number; y: number; hit: boolean; weBat: boolean };

export type LiveSnapshot = {
  status: string;
  /** Scored at-bat by at-bat (the live view has something to show). */
  scored: boolean;
  us: number;
  them: number;
  inning: number;
  half: Half;
  halfLabel: string;
  outs: number;
  balls: number;
  strikes: number;
  weBat: boolean;
  bases: Partial<Record<1 | 2 | 3, RunnerDot>>;
  batter: string | null;
  /** Our batter's line in this game so far ("1 for 2 today"). */
  batterToday: string | null;
  /** Our next batter after this one. */
  onDeck: string | null;
  pitcher: string | null;
  pitcherPitches: number;
  atBat: PitchChip[];
  feed: FeedItem[];
  spray: BattedBall[];
  /** Who scored on the latest play, so the field can run them home. */
  crossed: ScoredRunner[];
  fielders: FielderDot[];
  lastSeq: number;
};

const HITS = new Set<Result>(["1B", "2B", "3B", "HR"]);
const KS = new Set<Result>(["K", "KL"]);
const WALKS = new Set<Result>(["BB", "IBB", "HBP"]);

const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

/** Pitch-by-pitch for the current at-bat, read from the count snapshots the scorer saves. */
export function pitchChips(history: PitchSnapshot[] | undefined): PitchChip[] {
  const out: PitchChip[] = [];
  let prev = { balls: 0, strikes: 0, pitches: 0 };
  for (const s of history ?? []) {
    if (s.pitches <= prev.pitches) {
      prev = s;
      continue;
    }
    const label = s.balls > prev.balls ? "Ball" : s.strikes > prev.strikes ? "Strike" : "Foul";
    out.push({ n: s.pitches, label, count: `${s.balls}–${s.strikes}` });
    prev = s;
  }
  return out;
}

export function tagFor(p: Play): FeedTag {
  if (p.kind === "pa" && p.result === "HR") return "hr";
  if (p.runs > 0) return "run";
  if (p.kind !== "pa" || !p.result) return null;
  if (HITS.has(p.result)) return "hit";
  if (KS.has(p.result)) return "k";
  if (WALKS.has(p.result)) return "walk";
  return p.outs > 0 ? "out" : null;
}

export function buildSnapshot(input: {
  status: string;
  teamScore: number | null;
  opponentScore: number | null;
  setup: LiveSetup | null;
  plays: Play[];
  names: Map<string, string>;
  feedLimit?: number;
}): LiveSnapshot {
  const { setup, plays, names } = input;
  const full = (id: string | null) =>
    !id ? "—" : id.startsWith("opponent:") ? "Opponent" : (names.get(id) ?? "Player");
  const first = (id: string | null) => full(id).split(" ")[0]!;
  const sit = setup ? situation(setup, plays) : null;
  const opp = opponentOrder(setup, plays);

  const bases: LiveSnapshot["bases"] = {};
  if (sit?.basesKnown) {
    for (const b of [1, 2, 3] as Base[]) {
      const id = sit.bases[b];
      if (id) {
        const ours = !id.startsWith("opponent:");
        bases[b] = { id, initials: ours ? initials(full(id)) : "OP", name: first(id), ours };
      }
    }
  }

  const visible = plays.filter(
    (p) => p.kind !== "bases" && (p.kind !== "sub" || p.slot || p.pitcherId),
  );
  const feed = visible
    .slice(-(input.feedLimit ?? 20))
    .reverse()
    .map((p) => ({
      seq: p.seq,
      when: `${p.half === "top" ? "Top" : "Bot"} ${p.inning}`,
      text: describePlay(
        p,
        first,
        opp.slots.has(p.seq) ? opponentLabel(setup, opp.slots.get(p.seq)!) : undefined,
      ),
      tag: tagFor(p),
      runs: p.runs,
      weBat: p.weBat,
    }));

  const spray = plays.flatMap((p) =>
    p.kind === "pa" && p.details?.location
      ? [
          {
            seq: p.seq,
            x: p.details.location.x,
            y: p.details.location.y,
            hit: !!p.result && HITS.has(p.result),
            weBat: p.weBat,
          },
        ]
      : [],
  );

  const pitcherId = sit && !sit.weBat ? sit.pitcherId : null;
  const pitcherPitches = pitcherId && setup ? pitchCount(setup, plays, pitcherId) : 0;
  const batterId = sit?.weBat && sit.lineup.length ? sit.lineup[sit.batterIdx] : null;
  const onDeckId =
    sit?.weBat && sit.lineup.length > 1
      ? sit.lineup[(sit.batterIdx + 1) % sit.lineup.length]
      : null;

  let ab = 0;
  let h = 0;
  for (const p of plays) {
    if (!batterId || p.kind !== "pa" || !p.weBat || p.batterId !== batterId || !p.result) continue;
    if (!NOT_AB.has(p.result)) ab += 1;
    if (HITS.has(p.result)) h += 1;
  }
  const batterToday = batterId ? (ab ? `${h} for ${ab} today` : "First at-bat today") : null;

  const last = plays.at(-1);
  const crossed: ScoredRunner[] =
    last?.details && last.runs > 0
      ? last.details.moves
          .filter((m) => m.to === "home")
          .map((m) => {
            const ours = !m.id.startsWith("opponent:");
            return {
              id: m.id,
              initials: ours ? initials(full(m.id)) : "OP",
              name: first(m.id),
              ours,
              from: m.from,
            };
          })
      : [];

  const weField = !!sit && !sit.weBat;
  const fielders: FielderDot[] = setup
    ? FIELD_POSITIONS.map((pos) => {
        const id = weField ? (pos === "P" ? sit.pitcherId : setup.defense?.[pos]) : null;
        return { pos, initials: id ? initials(full(id)) : null, ours: weField };
      })
    : [];

  return {
    status: input.status,
    scored: !!setup,
    us: sit ? sit.us : (input.teamScore ?? 0),
    them: sit ? sit.them : (input.opponentScore ?? 0),
    inning: sit?.inning ?? 1,
    half: sit?.half ?? "top",
    halfLabel: sit ? halfLabel(sit) : "",
    outs: sit?.outs ?? 0,
    balls: setup?.balls ?? 0,
    strikes: setup?.strikes ?? 0,
    weBat: sit?.weBat ?? false,
    bases,
    batter: sit
      ? sit.weBat
        ? batterId
          ? full(batterId)
          : null
        : opponentLabel(setup, opp.next)
      : null,
    batterToday,
    onDeck: onDeckId ? full(onDeckId) : null,
    pitcher: pitcherId ? full(pitcherId) : null,
    pitcherPitches,
    atBat: pitchChips(setup?.pitchHistory),
    feed,
    spray,
    crossed,
    fielders,
    lastSeq: plays.at(-1)?.seq ?? 0,
  };
}
