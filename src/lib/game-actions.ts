"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/auth/actions";
import { requireActiveOrg } from "@/lib/org";
import { dispatchPush } from "@/lib/push";
import { parseTime } from "@/lib/practices";
import {
  isGameKind,
  isHomeAway,
  lineTotals,
  loadGame,
  MAX_INNINGS,
  normalizeUrl,
  parseLineScore,
  type GameKind,
  type GameStatus,
  type HomeAway,
  type Inning,
} from "@/lib/games";
import type { Json, TablesInsert, TablesUpdate } from "@/types/database";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}(:\d{2})?$/;
const MAX_BULK = 60;

function revalidateGames(id?: string, tournamentId?: string | null) {
  for (const p of [
    "/games",
    "/calendar",
    "/",
    "/player",
    "/player/games",
    "/parent",
    "/parent/games",
    "/parent/schedule",
  ]) {
    revalidatePath(p);
  }
  if (id) {
    revalidatePath(`/games/${id}`);
    revalidatePath(`/player/games/${id}`);
    revalidatePath(`/parent/games/${id}`);
  }
  if (tournamentId) revalidatePath(`/games/tournaments/${tournamentId}`);
}

/** Only return to pages inside the games area. */
function safeReturn(value: FormDataEntryValue | null, fallback: string) {
  const v = String(value ?? "");
  return /^\/games(\/[\w-]+)*(\?[\w=&-]*)?$/.test(v) ? v : fallback;
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const formValues = (fd: FormData) =>
  Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)])) as Record<string, string>;

type GameFields = Omit<TablesInsert<"games">, "org_id">;

/** Validate the add / edit game form. */
function readGame(fd: FormData): { fields: GameFields } | { error: string } {
  const opponent = str(fd, "opponent").slice(0, 120);
  const date = str(fd, "date");
  const start = str(fd, "start_time");
  const arrival = str(fd, "arrival_time");
  const kind = str(fd, "kind") || "league";
  const homeAway = str(fd, "home_away") || "home";
  const group = str(fd, "group_id");
  const tournament = str(fd, "tournament_id");
  const innings = Number(str(fd, "innings_scheduled") || 7);
  if (!opponent) return { error: "Who are you playing? Enter the opponent." };
  if (!DATE.test(date)) return { error: "Choose a date." };
  if (start && !TIME.test(start)) return { error: "Enter a valid start time." };
  if (arrival && !TIME.test(arrival)) return { error: "Enter a valid arrival time." };
  if (!isGameKind(kind)) return { error: "Choose a game type." };
  if (!isHomeAway(homeAway)) return { error: "Choose home, away, or neutral." };
  if (!Number.isInteger(innings) || innings < 1 || innings > 12) {
    return { error: "Innings must be 1–12." };
  }
  return {
    fields: {
      opponent,
      date,
      start_time: start || null,
      arrival_time: arrival || null,
      kind,
      home_away: homeAway,
      group_id: UUID.test(group) ? group : null,
      tournament_id: UUID.test(tournament) ? tournament : null,
      location: str(fd, "location").slice(0, 200) || null,
      address: str(fd, "address").slice(0, 300) || null,
      notes: str(fd, "notes").slice(0, 4000) || null,
      innings_scheduled: innings,
    },
  };
}

async function staff() {
  const ctx = await requireActiveOrg();
  return ctx.isStaff ? ctx : null;
}

export async function createGame(_prev: FormState, fd: FormData): Promise<FormState> {
  const ctx = await staff();
  if (!ctx) return { error: "Only staff can add games." };
  const values = formValues(fd);
  const read = readGame(fd);
  if ("error" in read) return { error: read.error, values };
  const { data, error } = await ctx.supabase
    .from("games")
    .insert({ ...read.fields, org_id: ctx.org.id, created_by: ctx.user.id })
    .select("id")
    .single();
  if (error) return { error: error.message, values };
  revalidateGames(data.id, read.fields.tournament_id);
  redirect(safeReturn(fd.get("return_to"), `/games/${data.id}`));
}

export async function updateGame(_prev: FormState, fd: FormData): Promise<FormState> {
  const ctx = await staff();
  // Moving a scheduled game notifies the team (DB trigger); push it to phones.
  after(() => dispatchPush());
  if (!ctx) return { error: "Not allowed." };
  const id = str(fd, "id");
  if (!UUID.test(id)) return { error: "Game not found." };
  const read = readGame(fd);
  if ("error" in read) return { error: read.error };
  const { data, error } = await ctx.supabase
    .from("games")
    .update(read.fields)
    .eq("id", id)
    .eq("org_id", ctx.org.id)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Game not found." };
  revalidateGames(id, read.fields.tournament_id);
  return { message: "Saved." };
}

export type QuickRow = {
  date: string;
  startTime: string;
  opponent: string;
  homeAway: HomeAway;
  location: string;
};

/** Add a batch of games at once (quick season entry). */
export async function createGamesBulk(input: {
  rows: QuickRow[];
  kind: GameKind;
  groupId: string | null;
  tournamentId: string | null;
  arriveMinutes: number | null;
}): Promise<{ error?: string; count?: number }> {
  const ctx = await staff();
  if (!ctx) return { error: "Only staff can add games." };
  if (!Array.isArray(input?.rows)) return { error: "Nothing to add." };
  if (!isGameKind(input.kind)) return { error: "Choose a game type." };
  const arrive = input.arriveMinutes == null ? null : Math.round(Number(input.arriveMinutes));
  if (arrive != null && (!Number.isFinite(arrive) || arrive < 0 || arrive > 240)) {
    return { error: "Arrive-early minutes must be 0–240." };
  }
  const filled = input.rows.filter(
    (r) => r && (String(r.opponent ?? "").trim() || String(r.date ?? "").trim()),
  );
  if (filled.length === 0) return { error: "Fill in at least one game." };
  if (filled.length > MAX_BULK) return { error: `Add at most ${MAX_BULK} games at a time.` };

  const rows: TablesInsert<"games">[] = [];
  for (const [i, r] of filled.entries()) {
    const n = i + 1;
    const opponent = String(r.opponent ?? "")
      .trim()
      .slice(0, 120);
    const date = String(r.date ?? "").trim();
    const time = String(r.startTime ?? "").trim();
    if (!opponent) return { error: `Game ${n} needs an opponent.` };
    if (!DATE.test(date)) return { error: `Game ${n} (${opponent}) needs a date.` };
    if (time && !TIME.test(time)) return { error: `Game ${n} (${opponent}) has an invalid time.` };
    if (!isHomeAway(r.homeAway)) return { error: `Game ${n}: choose home, away, or neutral.` };
    const start = parseTime(time);
    const arrival = start != null && arrive ? Math.max(0, start - arrive) : null;
    rows.push({
      org_id: ctx.org.id,
      created_by: ctx.user.id,
      opponent,
      date,
      start_time: time || null,
      arrival_time:
        arrival == null
          ? null
          : `${String(Math.floor(arrival / 60)).padStart(2, "0")}:${String(arrival % 60).padStart(2, "0")}`,
      home_away: r.homeAway,
      location:
        String(r.location ?? "")
          .trim()
          .slice(0, 200) || null,
      kind: input.kind,
      group_id: input.groupId && UUID.test(input.groupId) ? input.groupId : null,
      tournament_id:
        input.tournamentId && UUID.test(input.tournamentId) ? input.tournamentId : null,
    });
  }
  const { error } = await ctx.supabase.from("games").insert(rows);
  if (error) return { error: error.message };
  revalidateGames(undefined, input.tournamentId);
  return { count: rows.length };
}

/** Copy a game to a new date (fresh, unscored). */
export async function duplicateGame(_prev: FormState, fd: FormData): Promise<FormState> {
  const ctx = await staff();
  if (!ctx) return { error: "Not allowed." };
  const source = await loadGame(ctx.supabase, str(fd, "id"));
  if (!source || source.orgId !== ctx.org.id) return { error: "Game not found." };
  const date = str(fd, "date");
  if (!DATE.test(date)) return { error: "Choose a date for the copy." };
  const { data, error } = await ctx.supabase
    .from("games")
    .insert({
      org_id: ctx.org.id,
      created_by: ctx.user.id,
      opponent: source.opponent,
      kind: source.kind,
      home_away: source.homeAway,
      date,
      start_time: source.startTime,
      arrival_time: source.arrivalTime,
      location: source.location,
      address: source.address,
      notes: source.notes,
      group_id: source.groupId,
      tournament_id: source.tournamentId,
      innings_scheduled: source.inningsScheduled,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidateGames(data.id, source.tournamentId);
  redirect(`/games/${data.id}`);
}

export async function deleteGame(fd: FormData) {
  const ctx = await staff();
  if (!ctx) return;
  const id = str(fd, "id");
  if (!UUID.test(id)) return;
  const { data } = await ctx.supabase
    .from("games")
    .delete()
    .eq("id", id)
    .eq("org_id", ctx.org.id)
    .select("tournament_id")
    .maybeSingle();
  revalidateGames(id, data?.tournament_id);
  redirect(data?.tournament_id ? `/games/tournaments/${data.tournament_id}` : "/games");
}

async function patchGame(id: string, patch: TablesUpdate<"games">): Promise<{ error?: string }> {
  const ctx = await staff();
  if (!ctx) return { error: "Not allowed." };
  if (!UUID.test(id)) return { error: "Game not found." };
  const { data, error } = await ctx.supabase
    .from("games")
    .update(patch)
    .eq("id", id)
    .eq("org_id", ctx.org.id)
    .select("id, tournament_id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Game not found." };
  revalidateGames(id, data.tournament_id);
  return {};
}

/** Postpone, cancel, or put a game back on the schedule. Notifies the team. */
export async function setGameStatus(
  id: string,
  status: Extract<GameStatus, "scheduled" | "postponed" | "canceled">,
): Promise<{ error?: string }> {
  after(() => dispatchPush());
  if (!["scheduled", "postponed", "canceled"].includes(status)) return { error: "Invalid status." };
  return patchGame(id, { status });
}

/** New date / time / place; puts a postponed game back on the schedule. Notifies the team. */
export async function rescheduleGame(_prev: FormState, fd: FormData): Promise<FormState> {
  after(() => dispatchPush());
  const date = str(fd, "date");
  const start = str(fd, "start_time");
  const arrival = str(fd, "arrival_time");
  if (!DATE.test(date)) return { error: "Choose the new date." };
  if (start && !TIME.test(start)) return { error: "Enter a valid start time." };
  if (arrival && !TIME.test(arrival)) return { error: "Enter a valid arrival time." };
  const r = await patchGame(str(fd, "id"), {
    status: "scheduled",
    date,
    start_time: start || null,
    arrival_time: arrival || null,
    location: str(fd, "location").slice(0, 200) || null,
    address: str(fd, "address").slice(0, 300) || null,
  });
  return r.error ? { error: r.error } : { message: "Rescheduled. The team has been notified." };
}

// ----------------------------------------------------------------- live scoring

/** Start scoring: status live, inning 1. */
export async function startGame(id: string): Promise<{ error?: string }> {
  const ctx = await staff();
  if (!ctx) return { error: "Not allowed." };
  const game = await loadGame(ctx.supabase, id);
  if (!game || game.orgId !== ctx.org.id) return { error: "Game not found." };
  const line = game.lineScore.length > 0 ? game.lineScore : [{ us: 0, them: 0 }];
  const t = lineTotals(line);
  return patchGame(id, {
    status: "live",
    current_inning: game.currentInning ?? 1,
    line_score: line as unknown as NonNullable<Json>,
    team_score: t.us,
    opponent_score: t.them,
  });
}

/** Save the running line score (scores follow the line totals). */
export async function saveLiveScore(
  id: string,
  line: Inning[],
  currentInning: number,
): Promise<{ error?: string }> {
  const parsed = parseLineScore(line);
  if ("error" in parsed) return { error: parsed.error };
  const inning = Math.round(Number(currentInning));
  if (!Number.isFinite(inning) || inning < 1 || inning > MAX_INNINGS) {
    return { error: "Invalid inning." };
  }
  const t = lineTotals(parsed.line);
  return patchGame(id, {
    line_score: parsed.line as unknown as NonNullable<Json>,
    current_inning: inning,
    team_score: t.us,
    opponent_score: t.them,
  });
}

/** Final score (defaults to the line totals but can be edited). Notifies the team. */
export async function endGame(
  id: string,
  teamScore: number,
  opponentScore: number,
  line: Inning[],
): Promise<{ error?: string }> {
  after(() => dispatchPush());
  const parsed = parseLineScore(line);
  if ("error" in parsed) return { error: parsed.error };
  for (const s of [teamScore, opponentScore]) {
    if (!Number.isInteger(s) || s < 0 || s > 99) return { error: "Scores must be 0–99." };
  }
  return patchGame(id, {
    status: "final",
    team_score: teamScore,
    opponent_score: opponentScore,
    line_score: parsed.line as unknown as NonNullable<Json>,
  });
}

/** Re-open a final game for corrections. */
export async function resumeGame(id: string): Promise<{ error?: string }> {
  return patchGame(id, { status: "live" });
}

// ----------------------------------------------------------------- tournaments

function readTournament(fd: FormData) {
  const name = str(fd, "name").slice(0, 120);
  const start = str(fd, "start_date");
  const end = str(fd, "end_date") || start;
  const urlRaw = str(fd, "url");
  const group = str(fd, "group_id");
  if (!name) return { error: "Give the tournament a name." } as const;
  if (!DATE.test(start)) return { error: "Choose a start date." } as const;
  if (!DATE.test(end)) return { error: "Choose an end date." } as const;
  if (end < start) return { error: "The end date is before the start date." } as const;
  const days = (Date.parse(end) - Date.parse(start)) / 86_400_000;
  if (days > 31) return { error: "A tournament can span at most 31 days." } as const;
  const url = urlRaw ? normalizeUrl(urlRaw) : null;
  if (urlRaw && !url) return { error: "Enter a full bracket link (https://…)." } as const;
  return {
    fields: {
      name,
      start_date: start,
      end_date: end,
      url,
      location: str(fd, "location").slice(0, 200) || null,
      address: str(fd, "address").slice(0, 300) || null,
      notes: str(fd, "notes").slice(0, 4000) || null,
      group_id: UUID.test(group) ? group : null,
    },
  } as const;
}

export async function createTournament(_prev: FormState, fd: FormData): Promise<FormState> {
  const ctx = await staff();
  if (!ctx) return { error: "Only staff can add tournaments." };
  const values = formValues(fd);
  const read = readTournament(fd);
  if ("error" in read) return { error: read.error, values };
  const { data, error } = await ctx.supabase
    .from("tournaments")
    .insert({ ...read.fields, org_id: ctx.org.id, created_by: ctx.user.id })
    .select("id")
    .single();
  if (error) return { error: error.message, values };
  revalidateGames(undefined, data.id);
  redirect(`/games/tournaments/${data.id}`);
}

export async function updateTournament(_prev: FormState, fd: FormData): Promise<FormState> {
  const ctx = await staff();
  if (!ctx) return { error: "Not allowed." };
  const id = str(fd, "id");
  if (!UUID.test(id)) return { error: "Tournament not found." };
  const read = readTournament(fd);
  if ("error" in read) return { error: read.error };
  const { data, error } = await ctx.supabase
    .from("tournaments")
    .update(read.fields)
    .eq("id", id)
    .eq("org_id", ctx.org.id)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Tournament not found." };
  revalidateGames(undefined, id);
  return { message: "Saved." };
}

/** Delete a tournament; its games stay on the schedule (unlinked). */
export async function deleteTournament(fd: FormData) {
  const ctx = await staff();
  if (!ctx) return;
  const id = str(fd, "id");
  if (UUID.test(id)) {
    await ctx.supabase.from("tournaments").delete().eq("id", id).eq("org_id", ctx.org.id);
  }
  revalidateGames(undefined, id);
  redirect("/games?view=tournaments");
}
