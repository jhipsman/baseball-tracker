"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireActiveOrg } from "@/lib/org";
import { dispatchPush } from "@/lib/push";
import {
  batterUp,
  deriveBox,
  emptySetup,
  outsFor,
  pitchCount,
  situation,
  type Play,
  type Result,
} from "@/lib/live/engine";
import { loadPlays, parseLiveState, type LiveState, type LiveSummary } from "@/lib/live/data";
import { updatePitchCount, type PitchKind } from "@/lib/live/pitch-count";
import {
  defaultRbi,
  opponentBatterId,
  parsePlayDetails,
  proposeMoves,
  resolveRunnerPlay,
  type PlayDetails,
} from "@/lib/live/runners";
import type { Json } from "@/types/database";

export type { PitchKind } from "@/lib/live/pitch-count";

type R = { error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PA = new Set<Result>([
  "1B",
  "2B",
  "3B",
  "HR",
  "BB",
  "IBB",
  "HBP",
  "K",
  "KL",
  "GO",
  "FO",
  "LO",
  "PO",
  "E",
  "FC",
  "SAC",
  "SF",
  "DP",
]);

function refresh(id: string) {
  for (const p of [
    `/games/${id}`,
    `/games/${id}/live`,
    `/player/games/${id}`,
    `/parent/games/${id}`,
  ]) {
    revalidatePath(p);
  }
}

async function staffGame(id: string) {
  const ctx = await requireActiveOrg();
  if (!ctx.isStaff) return { error: "Only coaches can score games." } as const;
  if (!UUID.test(id)) return { error: "Game not found." } as const;
  const { data: game } = await ctx.supabase
    .from("games")
    .select("id, org_id, status, home_away, live_state")
    .eq("id", id)
    .maybeSingle();
  if (!game || game.org_id !== ctx.org.id) return { error: "Game not found." } as const;
  return { ...ctx, game, live: parseLiveState(game.live_state) };
}

/** Recompute everything from the log: summary, line score, score, box score. */
async function sync(
  supabase: Awaited<ReturnType<typeof requireActiveOrg>>["supabase"],
  gameId: string,
  live: LiveState,
) {
  const plays = await loadPlays(supabase, gameId);
  const s = situation(live, plays);
  const summary: LiveSummary = {
    inning: s.inning,
    half: s.half,
    outs: s.outs,
    weBat: s.weBat,
    batterId: batterUp(s),
    pitcherId: s.pitcherId,
    pitcherPitches: s.pitcherId ? pitchCount(live, plays, s.pitcherId) : 0,
    balls: live.balls,
    strikes: live.strikes,
  };
  const lineScore = s.lineScore;

  // Keep pitching decisions a coach may have set on the box score.
  const { data: existing } = await supabase
    .from("game_pitching")
    .select("player_id, decision")
    .eq("game_id", gameId);
  const decisions = new Map((existing ?? []).map((r) => [r.player_id, r.decision]));

  const box = deriveBox(live, plays, live.pitches);
  const { error: boxError } = await supabase.rpc("save_box_score", {
    p_game_id: gameId,
    p_batting: box.batting as unknown as Json,
    p_pitching: box.pitching
      .filter((l) => l.outs || l.pitches || l.h || l.bb || l.r || l.hbp)
      .map((l) => ({ ...l, decision: decisions.get(l.player_id) ?? null })) as unknown as Json,
  });
  if (boxError) return { error: boxError.message };

  const { error } = await supabase
    .from("games")
    .update({
      live_state: { ...live, summary } as unknown as Json,
      line_score: lineScore as unknown as NonNullable<Json>,
      team_score: s.us,
      opponent_score: s.them,
      current_inning: s.inning,
    })
    .eq("id", gameId);
  return error ? { error: error.message } : {};
}

export async function startLiveScoring(
  gameId: string,
  input: { lineup: string[]; pitcherId: string | null; weBatFirst: boolean },
): Promise<R> {
  const g = await staffGame(gameId);
  if ("error" in g) return { error: g.error };
  const lineup = [...new Set((input.lineup ?? []).filter((x) => UUID.test(x)))];
  if (lineup.length < 1 || lineup.length > 15) return { error: "Add 1–15 batters to the lineup." };
  const pitcherId = input.pitcherId && UUID.test(input.pitcherId) ? input.pitcherId : null;

  const { count } = await g.supabase
    .from("game_plays")
    .select("id", { count: "exact", head: true })
    .eq("game_id", gameId);
  if ((count ?? 0) > 0) {
    return { error: "The game has started. Use substitutions to change the lineup or pitcher." };
  }

  const live = emptySetup(lineup, pitcherId, !!input.weBatFirst);
  const { error } = await g.supabase
    .from("games")
    .update({
      live_state: live as unknown as Json,
      status: g.game.status === "final" ? "final" : "live",
      current_inning: 1,
    })
    .eq("id", gameId);
  if (error) return { error: error.message };
  const res = await sync(g.supabase, gameId, live);
  refresh(gameId);
  return res;
}

/** One pitch to the current batter (when we're in the field). Completes walks and strikeouts. */
export async function recordPitch(gameId: string, kind: PitchKind): Promise<R & { auto?: Result }> {
  const g = await staffGame(gameId);
  if ("error" in g) return { error: g.error };
  if (!g.live) return { error: "Set the lineup first." };
  if (g.game.status !== "live") return { error: "Resume live scoring before recording pitches." };
  const s = situation(g.live, await loadPlays(g.supabase, gameId));
  if (!s.weBat && !s.pitcherId) return { error: "Choose who's pitching first." };
  const update = updatePitchCount(g.live, kind);
  if ("error" in update) return update;
  const { live, auto } = update;
  if (auto) {
    const res = await insertPlay(g, live, { kind: "pa", result: auto });
    return { ...res, auto };
  }
  // The existing box-score RPC feeds throwing_logs, so workload updates on
  // each pitch rather than waiting until the plate appearance is completed.
  const res = await sync(g.supabase, gameId, live);
  refresh(gameId);
  return res;
}

export type PlayInput = {
  kind: Play["kind"];
  result?: Result | null;
  rbi?: number;
  runs?: number;
  unearned?: number;
  scored?: string[];
  extraOuts?: number;
  /** Runner for a steal; incoming player for a substitution. */
  playerId?: string | null;
  /** Lineup slot for a batting substitution (1-based). */
  slot?: number | null;
  /** Pitches for this at-bat when not tapping pitch by pitch. */
  pitches?: number;
  details?: PlayDetails;
  /** Last committed sequence seen when opening the play. Reject stale confirmations. */
  expectedSeq?: number;
  /** Add the contact pitch only when the entire guided play is confirmed. */
  addPitch?: boolean;
};

export async function recordPlay(gameId: string, input: PlayInput): Promise<R> {
  const g = await staffGame(gameId);
  if ("error" in g) return { error: g.error };
  if (!g.live) return { error: "Set the lineup first." };
  if (g.game.status !== "live") return { error: "Resume live scoring before recording a play." };
  return insertPlay(g, { ...g.live }, input);
}

const clamp = (v: unknown, lo: number, hi: number) => {
  const n = Math.round(Number(v) || 0);
  return Math.min(hi, Math.max(lo, n));
};

async function insertPlay(
  g: Exclude<Awaited<ReturnType<typeof staffGame>>, { error: string }>,
  live: LiveState,
  input: PlayInput,
): Promise<R> {
  const plays = await loadPlays(g.supabase, g.game.id);
  const s = situation(live, plays);
  const seq = (plays.at(-1)?.seq ?? 0) + 1;
  if (input.expectedSeq !== undefined && input.expectedSeq !== seq - 1)
    return { error: "Another play was recorded. Refresh before confirming this one." };
  const base = {
    game_id: g.game.id,
    org_id: g.org.id,
    seq,
    inning: s.inning,
    half: s.half,
    we_bat: s.weBat,
    created_by: g.user.id,
  };

  let row: Record<string, unknown>;
  if (input.kind === "pa") {
    const result = input.result ?? null;
    if (!result || !PA.has(result)) return { error: "Pick what happened." };
    let runs = clamp(input.runs, 0, 4);
    let scored = s.weBat
      ? [...new Set((input.scored ?? []).filter((x) => UUID.test(x)))].slice(0, runs)
      : [];
    const batter = s.weBat ? batterUp(s) : null;
    if (s.weBat && !batter) return { error: "Set the lineup first." };
    if (!s.weBat && !s.pitcherId) return { error: "Choose who's pitching first." };
    let details = input.details;
    // Automatic walks/strikeouts and legacy callers still get deterministic
    // runner movement when the current bases are known.
    if (!details && s.basesKnown && ["BB", "IBB", "HBP", "K", "KL"].includes(result)) {
      details = {
        version: 1,
        moves: proposeMoves(s.bases, batter ?? opponentBatterId(seq), result),
        thirdOut: "force",
      };
    }
    let resolved: ReturnType<typeof resolveRunnerPlay> | undefined;
    if (details) {
      if (!s.basesKnown) return { error: "Set the current bases before tracking this play." };
      resolved = resolveRunnerPlay({
        bases: s.bases,
        batterId: batter ?? opponentBatterId(seq),
        result,
        outsBefore: s.outs,
        details,
      });
      if ("error" in resolved) return resolved;
      runs = resolved.runs;
      scored = s.weBat ? resolved.scored : [];
    }
    const recordedPitches = live.pitches + (input.addPitch ? 1 : 0);
    if (recordedPitches > 40)
      return { error: "This at-bat has reached the 40-pitch storage limit." };
    row = {
      ...base,
      kind: "pa",
      result,
      batter_id: batter,
      pitcher_id: s.weBat ? null : s.pitcherId,
      rbi: s.weBat
        ? Math.min(
            input.rbi === undefined && details ? defaultRbi(result, runs) : clamp(input.rbi, 0, 4),
            runs,
          )
        : 0,
      runs,
      unearned: s.weBat ? 0 : Math.min(clamp(input.unearned, 0, 4), runs),
      scored:
        result === "HR" && batter && !scored.includes(batter)
          ? [...scored, batter].slice(0, runs)
          : scored,
      pitches: recordedPitches || clamp(input.pitches, 0, 40),
      outs:
        resolved && !("error" in resolved)
          ? resolved.outs
          : Math.min(3 - s.outs, outsFor(result) + clamp(input.extraOuts, 0, 2)),
      play_details: resolved && !("error" in resolved) ? resolved.details : null,
    };
  } else if (input.kind === "steal") {
    const result = input.result === "CS" ? "CS" : "SB";
    if (s.weBat && !(input.playerId && s.lineup.includes(input.playerId))) {
      return { error: "Pick the runner." };
    }
    if (!s.weBat && result !== "CS") return { error: "Only caught stealing is tracked for them." };
    row = {
      ...base,
      kind: "steal",
      result,
      batter_id: s.weBat ? input.playerId : null,
      pitcher_id: s.weBat ? null : s.pitcherId,
      outs: result === "CS" ? 1 : 0,
      pitches: !s.weBat && result === "CS" && s.outs === 2 ? live.pitches : 0,
    };
  } else if (input.kind === "runner") {
    if (!s.basesKnown) return { error: "Set the current bases first." };
    const details = parsePlayDetails(input.details);
    if (!details?.reason || details.snapshot)
      return { error: "Choose what happened to the runner." };
    const resolved = resolveRunnerPlay({
      bases: s.bases,
      batterId: null,
      result: null,
      outsBefore: s.outs,
      details,
    });
    if ("error" in resolved) return resolved;
    const changed = details.moves.filter((m) => m.to !== m.from);
    if (!changed.length) return { error: "Change at least one runner's outcome." };
    if (
      ["stolen_base", "caught_stealing"].includes(details.reason) &&
      (changed.length !== 1 ||
        (details.reason === "caught_stealing"
          ? changed[0].to !== "out"
          : changed[0].to === "out" || changed[0].to === "no_run"))
    )
      return { error: "Resolve one runner for a stolen base or caught stealing." };
    const result =
      details.reason === "stolen_base" ? "SB" : details.reason === "caught_stealing" ? "CS" : null;
    row = {
      ...base,
      kind: "runner",
      result,
      batter_id: s.weBat ? changed[0].id : null,
      pitcher_id: s.weBat ? null : s.pitcherId,
      runs: resolved.runs,
      scored: s.weBat ? resolved.scored : [],
      outs: resolved.outs,
      unearned: s.weBat ? 0 : Math.min(clamp(input.unearned, 0, 4), resolved.runs),
      pitches: resolved.outs + s.outs === 3 ? live.pitches : 0,
      play_details: resolved.details,
    };
  } else if (input.kind === "bases") {
    const details = parsePlayDetails(input.details);
    if (!details?.snapshot || details.moves.length) return { error: "Choose the players on base." };
    if (s.weBat) {
      const { data: members } = await g.supabase
        .from("org_memberships")
        .select("profile_id")
        .eq("org_id", g.org.id)
        .eq("role", "player");
      const players = new Set((members ?? []).map((m) => m.profile_id));
      if (Object.values(details.snapshot).some((id) => !players.has(id)))
        return { error: "Select players from this team's roster." };
    } else if (Object.values(details.snapshot).some((id) => !/^opponent:[a-zA-Z0-9:-]+$/.test(id)))
      return { error: "Choose the opponent's occupied bases." };
    row = { ...base, kind: "bases", play_details: details };
  } else if (input.kind === "sub") {
    if (!input.playerId || !UUID.test(input.playerId)) return { error: "Pick the player." };
    if (input.slot) {
      const slot = clamp(input.slot, 1, s.lineup.length);
      row = { ...base, kind: "sub", slot, batter_id: input.playerId };
    } else {
      row = {
        ...base,
        kind: "sub",
        pitcher_id: input.playerId,
        pitches: s.weBat ? 0 : live.pitches,
      };
      // Keep the batter's count, bank the outgoing pitches on this change,
      // and start a fresh pitch segment for the incoming pitcher.
      if (!s.weBat) {
        live.pitches = 0;
        live.pitchHistory = [];
      }
    }
  } else if (input.kind === "half_end") {
    row = {
      ...base,
      kind: "half_end",
      runs: clamp(input.runs, 0, 30),
      pitcher_id: s.weBat ? null : s.pitcherId,
      pitches: s.weBat ? 0 : live.pitches,
    };
  } else {
    return { error: "Unknown play." };
  }

  const { error } = await g.supabase.from("game_plays").insert(row as never);
  if (error) {
    return {
      error: error.code === "23505" ? "Someone else just recorded a play. Refresh." : error.message,
    };
  }
  if (input.kind === "pa" || input.kind === "half_end" || s.outs + Number(row.outs ?? 0) >= 3) {
    live.balls = 0;
    live.strikes = 0;
    live.pitches = 0;
    live.pitchHistory = [];
  }
  const res = await sync(g.supabase, g.game.id, live);
  refresh(g.game.id);
  return res;
}

export async function undoLastPlay(gameId: string): Promise<R> {
  const g = await staffGame(gameId);
  if ("error" in g) return { error: g.error };
  if (!g.live) return {};
  const { data: last } = await g.supabase
    .from("game_plays")
    .select("id, kind, slot, pitches, we_bat, outs")
    .eq("game_id", gameId)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last) return { error: "Nothing to undo." };
  const pitchingChange = last.kind === "sub" && last.slot == null && !last.we_bat;
  const preservesCount =
    last.kind === "bases" ||
    (last.kind === "sub" && !pitchingChange) ||
    (last.kind === "runner" && last.pitches === 0);
  if (pitchingChange && g.live.pitches > 0) {
    return { error: "Remove the incoming pitcher's pitches before undoing the pitching change." };
  }
  const { error } = await g.supabase.from("game_plays").delete().eq("id", last.id);
  if (error) return { error: error.message };
  const live = preservesCount
    ? { ...g.live }
    : pitchingChange
      ? { ...g.live, pitches: last.pitches, pitchHistory: [] }
      : { ...g.live, balls: 0, strikes: 0, pitches: 0, pitchHistory: [] };
  const res = await sync(g.supabase, gameId, live);
  refresh(gameId);
  return res;
}

/** Ends the game with the score from the log; players and parents get the final. */
export async function finishLiveGame(gameId: string): Promise<R> {
  after(() => dispatchPush());
  const g = await staffGame(gameId);
  if ("error" in g) return { error: g.error };
  if (!g.live) return { error: "Nothing has been scored yet." };
  // Keep an unfinished at-bat's pitches (and count for a later resumption).
  const res = await sync(g.supabase, gameId, g.live);
  if (res.error) return res;
  const { error } = await g.supabase.from("games").update({ status: "final" }).eq("id", gameId);
  if (error) return { error: error.message };
  refresh(gameId);
  revalidatePath("/games");
  return {};
}
