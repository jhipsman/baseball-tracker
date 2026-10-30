import type { Bases } from "@/lib/live/runners";
import type { Defense } from "@/lib/live/defense";
import type { PitchKind, PlayInput } from "@/lib/live-actions";

export type ScoringPlayer = { id: string; name: string };
export type SmartStatus = {
  ages: string;
  dailyMax: number;
  left: number;
  restNow: number;
  untilMoreRest: number | null;
  restAfterNext: number;
  over: boolean;
} | null;
export type ScorerProps = {
  gameId: string;
  final: boolean;
  inningLabel: string;
  outs: number;
  weBat: boolean;
  us: number;
  them: number;
  teamName: string;
  opponent: string;
  weBatFirst: boolean;
  lineup: ScoringPlayer[];
  batterIdx: number;
  pitcher: ScoringPlayer | null;
  pitches: number;
  atBatPitches: number;
  balls: number;
  strikes: number;
  smart: SmartStatus;
  hasBirthdate: boolean;
  roster: ScoringPlayer[];
  feed: { seq: number; label: string; text: string }[];
  bases: Bases;
  basesKnown: boolean;
  lastSeq: number;
  lineScore: { us: number; them: number }[];
  /** Our fielders by position (P is the current pitcher). */
  defense: Defense;
  /** Their batting order labels; blanks show as "Batter N". */
  oppLineup: string[];
  /** Their next batter's spot (0-based). */
  oppNext: number;
};
export type ScoringActions = {
  record: (input: PlayInput) => Promise<{ error?: string }>;
  pitch: (kind: PitchKind) => Promise<{ error?: string }>;
  undo: () => Promise<{ error?: string }>;
  finish: () => Promise<{ error?: string }>;
  setup: (input: {
    defense?: Record<string, string>;
    oppLineup?: string[];
  }) => Promise<{ error?: string }>;
};
