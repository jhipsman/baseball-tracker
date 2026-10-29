"use server";

import { revalidatePath } from "next/cache";
import { requireActiveOrg } from "@/lib/org";
import {
  BATTING_FIELDS,
  DECISIONS,
  PITCHING_FIELDS,
  validateBoxScore,
  type BattingLine,
  type BoxScoreInput,
  type Decision,
  type PitchingLine,
} from "@/lib/stats";

export type BoxScorePayload = {
  batting: (BattingLine & {
    player_id: string;
    batting_order: number | null;
    position: string | null;
  })[];
  pitching: (PitchingLine & { player_id: string })[];
};

export type SaveResult = { error?: string; message?: string };

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const int = (v: unknown) => (typeof v === "number" ? v : Number(v));
const intOrNull = (v: unknown) => (v == null || v === "" ? null : int(v));

/** Replace a game's box score (coaches only). Validates with the same rules as the form. */
export async function saveBoxScore(gameId: string, payload: BoxScorePayload): Promise<SaveResult> {
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) return { error: "Only coaches can enter box scores." };
  if (!isUuid(gameId)) return { error: "Game not found." };

  const { data: game } = await supabase
    .from("games")
    .select("id, org_id, team_score, opponent_score")
    .eq("id", gameId)
    .maybeSingle();
  if (!game || game.org_id !== org.id) return { error: "Game not found." };

  const batting = (payload?.batting ?? []).slice(0, 40).map((b) => ({
    player_id: String(b.player_id),
    batting_order: intOrNull(b.batting_order),
    position: b.position ? String(b.position).trim().toUpperCase().slice(0, 8) || null : null,
    ...(Object.fromEntries(BATTING_FIELDS.map((f) => [f, int(b[f] ?? 0)])) as BattingLine),
  }));
  const pitching = (payload?.pitching ?? []).slice(0, 30).map((p) => ({
    player_id: String(p.player_id),
    ...(Object.fromEntries(PITCHING_FIELDS.map((f) => [f, int(p[f] ?? 0)])) as Omit<
      PitchingLine,
      "pitches" | "strikes" | "decision"
    >),
    pitches: intOrNull(p.pitches),
    strikes: intOrNull(p.strikes),
    decision: DECISIONS.includes(p.decision as Decision) ? (p.decision as Decision) : null,
  }));
  if ([...batting, ...pitching].some((r) => !isUuid(r.player_id)))
    return { error: "Every row needs a player." };

  const box: BoxScoreInput = {
    batting,
    pitching,
    teamScore: game.team_score,
    opponentScore: game.opponent_score,
  };
  const check = validateBoxScore(box);
  if (!check.ok) {
    const cell = [...check.batting, ...check.pitching].flatMap((e) => Object.values(e))[0];
    return { error: check.errors[0] ?? cell ?? "Fix the highlighted boxes." };
  }

  const { error } = await supabase.rpc("save_box_score", {
    p_game_id: gameId,
    p_batting: batting,
    p_pitching: pitching,
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  const n = batting.length + pitching.length;
  return {
    message:
      n === 0
        ? "Box score cleared."
        : `Saved ${batting.length} batter${batting.length === 1 ? "" : "s"} and ${pitching.length} pitcher${pitching.length === 1 ? "" : "s"}.`,
  };
}

/** Team setting: who can see game stats. Organizations can only be updated by admins (RLS). */
export async function setStatsVisibility(
  _prev: SaveResult,
  formData: FormData,
): Promise<SaveResult> {
  const { supabase, org, membership } = await requireActiveOrg();
  if (membership.role !== "admin") return { error: "Only a team admin can change this." };
  const value = String(formData.get("stats_visibility") ?? "");
  if (value !== "team" && value !== "own") return { error: "Pick an option." };
  const { error } = await supabase
    .from("organizations")
    .update({ stats_visibility: value })
    .eq("id", org.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {
    message:
      value === "team"
        ? "Everyone on the team can now see all stats."
        : "Players and parents now see only their own player's stats.",
  };
}
