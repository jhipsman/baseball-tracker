import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { Half, LiveSetup, Play, Result } from "./engine";
import { parsePitchHistory } from "./pitch-count";
import { parsePlayDetails } from "./runners";

type Client = SupabaseClient<Database>;

/** Viewer-facing summary saved alongside the setup on every change. */
export type LiveSummary = {
  inning: number;
  half: Half;
  outs: number;
  weBat: boolean;
  batterId: string | null;
  pitcherId: string | null;
  pitcherPitches: number;
  balls: number;
  strikes: number;
};

export type LiveState = LiveSetup & { summary?: LiveSummary };

const ids = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
const int = (v: unknown, max: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? Math.min(n, max) : 0;
};

export function parseLiveState(raw: Json | null): LiveState | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  return {
    lineup: ids(r.lineup),
    pitcherId: typeof r.pitcherId === "string" ? r.pitcherId : null,
    weBatFirst: r.weBatFirst === true,
    balls: int(r.balls, 3),
    strikes: int(r.strikes, 2),
    pitches: int(r.pitches, 40),
    pitchHistory: parsePitchHistory(r.pitchHistory),
    summary: (r.summary as LiveSummary | undefined) ?? undefined,
  };
}

const PLAY_COLUMNS =
  "seq, inning, half, we_bat, kind, batter_id, pitcher_id, slot, result, rbi, runs, unearned, scored, pitches, outs, play_details";

type PlayRow = {
  seq: number;
  inning: number;
  half: string;
  we_bat: boolean;
  kind: string;
  batter_id: string | null;
  pitcher_id: string | null;
  slot: number | null;
  result: string | null;
  rbi: number;
  runs: number;
  unearned: number;
  scored: string[];
  pitches: number;
  outs: number;
  play_details?: Json | null;
};

export const toPlay = (r: PlayRow): Play => ({
  seq: r.seq,
  inning: r.inning,
  half: r.half as Half,
  weBat: r.we_bat,
  kind: r.kind as Play["kind"],
  batterId: r.batter_id,
  pitcherId: r.pitcher_id,
  slot: r.slot,
  result: r.result as Result | null,
  rbi: r.rbi,
  runs: r.runs,
  unearned: r.unearned,
  scored: r.scored ?? [],
  pitches: r.pitches,
  outs: r.outs,
  details: parsePlayDetails(r.play_details),
});

/** The game's plays visible to the viewer (RLS applies the team's stats privacy). */
export async function loadPlays(supabase: Client, gameId: string) {
  const { data, error } = await supabase
    .from("game_plays")
    .select(PLAY_COLUMNS)
    .eq("game_id", gameId)
    .order("seq");
  if (error) throw error;
  return (data ?? []).map((r) => toPlay(r as PlayRow));
}

/** Names of the team's players, for the lineup and feed. */
export async function loadPlayerNames(supabase: Client, orgId: string) {
  const { data } = await supabase
    .from("org_memberships")
    .select("profile_id, profile:profiles (full_name, email)")
    .eq("org_id", orgId)
    .eq("role", "player");
  const names = new Map<string, string>();
  for (const m of data ?? []) {
    names.set(m.profile_id, m.profile?.full_name || m.profile?.email || "Player");
  }
  return names;
}
