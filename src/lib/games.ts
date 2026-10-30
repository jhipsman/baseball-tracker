import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums } from "@/types/database";
import { formatTime12, parseTime } from "@/lib/practices";
import { addDays } from "@/lib/schedule";

// Isomorphic: pure helpers (used by client components and unit-tested) +
// loaders that take a Supabase client (RLS decides what each viewer can see).

export type GameKind = Enums<"game_kind">;
export type HomeAway = Enums<"home_away">;
export type GameStatus = Enums<"game_status">;
export type Inning = { us: number; them: number };
export type Result = "W" | "L" | "T";

export const GAME_KINDS: { key: GameKind; label: string }[] = [
  { key: "league", label: "League" },
  { key: "non_league", label: "Non-league" },
  { key: "scrimmage", label: "Scrimmage" },
  { key: "tournament", label: "Tournament" },
  { key: "playoff", label: "Playoff" },
];
export const KIND_LABEL = Object.fromEntries(GAME_KINDS.map((k) => [k.key, k.label])) as Record<
  GameKind,
  string
>;

export const HOME_AWAY: { key: HomeAway; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "away", label: "Away" },
  { key: "neutral", label: "Neutral" },
];
export const HOME_AWAY_LABEL = Object.fromEntries(HOME_AWAY.map((k) => [k.key, k.label])) as Record<
  HomeAway,
  string
>;

export const STATUS_LABEL: Record<GameStatus, string> = {
  scheduled: "Scheduled",
  live: "Live",
  final: "Final",
  postponed: "Postponed",
  canceled: "Canceled",
};

export const isGameKind = (v: unknown): v is GameKind => GAME_KINDS.some((k) => k.key === v);
export const isHomeAway = (v: unknown): v is HomeAway => HOME_AWAY.some((k) => k.key === v);

export type Game = {
  id: string;
  orgId: string;
  groupId: string | null;
  groupName: string | null;
  tournamentId: string | null;
  tournamentName: string | null;
  opponent: string;
  kind: GameKind;
  homeAway: HomeAway;
  date: string;
  startTime: string | null;
  arrivalTime: string | null;
  location: string | null;
  address: string | null;
  notes: string | null;
  status: GameStatus;
  teamScore: number | null;
  opponentScore: number | null;
  lineScore: Inning[];
  currentInning: number | null;
  inningsScheduled: number;
  updatedAt: string;
};

export type Tournament = {
  id: string;
  orgId: string;
  groupId: string | null;
  groupName: string | null;
  name: string;
  startDate: string;
  endDate: string;
  location: string | null;
  address: string | null;
  url: string | null;
  notes: string | null;
};

// ----------------------------------------------------------------- pure helpers

export const MAX_INNINGS = 30;
export const MAX_RUNS = 99;

/** W / L / T for a final game with both scores, otherwise null. */
export function gameResult(g: {
  status: GameStatus;
  teamScore: number | null;
  opponentScore: number | null;
}): Result | null {
  if (g.status !== "final" || g.teamScore == null || g.opponentScore == null) return null;
  if (g.teamScore > g.opponentScore) return "W";
  if (g.teamScore < g.opponentScore) return "L";
  return "T";
}

export type Record3 = { w: number; l: number; t: number };

/** Win–loss–tie over final games. Scrimmages don't count. */
export function recordOf(
  games: {
    status: GameStatus;
    kind: GameKind;
    teamScore: number | null;
    opponentScore: number | null;
  }[],
): Record3 {
  const r: Record3 = { w: 0, l: 0, t: 0 };
  for (const g of games) {
    if (g.kind === "scrimmage") continue;
    const res = gameResult(g);
    if (res === "W") r.w++;
    else if (res === "L") r.l++;
    else if (res === "T") r.t++;
  }
  return r;
}

/** "8–3–1" (ties always shown when `withTies`, otherwise only when there are any → "8–3"). */
export function formatRecord(r: Record3, withTies = false) {
  return withTies || r.t > 0 ? `${r.w}–${r.l}–${r.t}` : `${r.w}–${r.l}`;
}

/** Runs per side across all innings. */
export function lineTotals(line: Inning[]): Inning {
  return line.reduce((s, i) => ({ us: s.us + i.us, them: s.them + i.them }), { us: 0, them: 0 });
}

/**
 * Clean a line score from JSON / client input: an array of `{us, them}` with
 * whole runs 0–99 per inning, at most 30 innings, totals ≤ 99. Returns an
 * error for anything else.
 */
export function parseLineScore(value: unknown): { line: Inning[] } | { error: string } {
  if (!Array.isArray(value)) return { error: "Line score must be a list of innings." };
  if (value.length > MAX_INNINGS) return { error: `At most ${MAX_INNINGS} innings.` };
  const line: Inning[] = [];
  for (const [i, raw] of value.entries()) {
    if (!raw || typeof raw !== "object") return { error: `Inning ${i + 1} is invalid.` };
    const r = raw as Record<string, unknown>;
    const us = Number(r.us ?? 0);
    const them = Number(r.them ?? 0);
    for (const n of [us, them]) {
      if (!Number.isInteger(n) || n < 0 || n > MAX_RUNS) {
        return { error: `Inning ${i + 1} needs 0–${MAX_RUNS} runs.` };
      }
    }
    line.push({ us, them });
  }
  const t = lineTotals(line);
  if (t.us > MAX_RUNS || t.them > MAX_RUNS) return { error: `Scores top out at ${MAX_RUNS}.` };
  return { line };
}

/** Line score from a stored value; anything malformed reads as no innings. */
export function normalizeLineScore(value: unknown): Inning[] {
  const parsed = parseLineScore(value);
  return "line" in parsed ? parsed.line : [];
}

/** Pad the line score with scoreless innings up to `innings`. */
export function ensureInnings(line: Inning[], innings: number): Inning[] {
  const n = Math.min(Math.max(innings, 0), MAX_INNINGS);
  if (line.length >= n) return line;
  return [...line, ...Array.from({ length: n - line.length }, () => ({ us: 0, them: 0 }))];
}

/** Add `delta` runs for one side in a 1-based inning (clamped to 0 and the 99-run cap). */
export function addRuns(line: Inning[], inning: number, side: keyof Inning, delta: number) {
  const next = ensureInnings(line, inning).map((i) => ({ ...i }));
  const cell = next[inning - 1];
  if (!cell) return line;
  const total = lineTotals(next)[side];
  const room = MAX_RUNS - total;
  const change = Math.max(-cell[side], Math.min(delta, room));
  cell[side] += change;
  return next;
}

/** "vs Tigers" (home / neutral) or "@ Tigers" (away). */
export function matchupLabel(homeAway: HomeAway, opponent: string) {
  return `${homeAway === "away" ? "@" : "vs"} ${opponent}`;
}

/** "15:30:00" → "3:30 PM", or null. */
export function formatGameTime(time: string | null | undefined) {
  const m = parseTime(time);
  return m == null ? null : formatTime12(m);
}

/** "W 7–3", "L 2–5", "T 4–4" for a final; "5–3" for a live score; null otherwise. */
export function scoreLabel(g: {
  status: GameStatus;
  teamScore: number | null;
  opponentScore: number | null;
}) {
  if (g.teamScore == null || g.opponentScore == null) return null;
  const score = `${g.teamScore}–${g.opponentScore}`;
  const res = gameResult(g);
  if (res) return `${res} ${score}`;
  return g.status === "live" ? score : null;
}

/** Google Maps search link for an address (or a place name), or null. */
export function directionsUrl(address: string | null | undefined, location?: string | null) {
  const q = (address || location || "").trim();
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

const fmtDate = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });

/** "Sat, Nov 1" for a YYYY-MM-DD date. */
export function formatGameDate(date: string, opts?: Intl.DateTimeFormatOptions) {
  return fmtDate(date, { weekday: "short", month: "short", day: "numeric", ...opts });
}

/** "Nov 1–3", "Oct 31 – Nov 2", or "Sat, Nov 1" for one day. */
export function dateRangeLabel(start: string, end: string) {
  if (start === end) return formatGameDate(start);
  const s = fmtDate(start, { month: "short", day: "numeric" });
  if (start.slice(0, 7) === end.slice(0, 7)) return `${s}–${Number(end.slice(8))}`;
  return `${s} – ${fmtDate(end, { month: "short", day: "numeric" })}`;
}

/** Make a bracket link absolute ("example.com/x" → "https://example.com/x"); null if unusable. */
export function normalizeUrl(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------- calendar file

export type IcsGame = Pick<
  Game,
  | "id"
  | "opponent"
  | "homeAway"
  | "date"
  | "startTime"
  | "arrivalTime"
  | "location"
  | "address"
  | "notes"
  | "status"
  | "tournamentName"
>;

/** Escape a TEXT value (RFC 5545 §3.3.11). */
export function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Fold a content line at 75 octets (continuation lines start with a space). */
export function foldIcsLine(line: string) {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines lose one octet to the space
    if (bytes + n > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const icsDate = (date: string) => date.replaceAll("-", "");
const icsDateTime = (date: string, minutes: number) => {
  const day = addDays(date, Math.floor(minutes / 1440));
  const m = minutes % 1440;
  return `${icsDate(day)}T${String(Math.floor(m / 60)).padStart(2, "0")}${String(m % 60).padStart(2, "0")}00`;
};

/** Default length of a game on the calendar. */
export const GAME_MINUTES = 120;

/**
 * A single-event iCalendar file for a game. Times are "floating" (local to
 * whoever opens it), which matches how coaches write game times. Games
 * without a start time become all-day events.
 */
export function gameIcs(g: IcsGame, opts: { teamName: string; url?: string; now?: Date }): string {
  const now = (opts.now ?? new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const start = parseTime(g.startTime);
  const arrive = formatGameTime(g.arrivalTime);
  const prefix =
    g.status === "canceled" ? "CANCELED: " : g.status === "postponed" ? "POSTPONED: " : "";
  const summary = `${prefix}${opts.teamName} ${matchupLabel(g.homeAway, g.opponent)}`;
  const where = [g.location, g.address].filter(Boolean).join(", ");
  const description = [
    arrive ? `Arrive by ${arrive}` : null,
    g.tournamentName ? `Tournament: ${g.tournamentName}` : null,
    g.notes,
    opts.url,
  ]
    .filter(Boolean)
    .join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//9D Systems//9D Games//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:game-${g.id}@diamond-program`,
    `DTSTAMP:${now}`,
    ...(start == null
      ? [`DTSTART;VALUE=DATE:${icsDate(g.date)}`, `DTEND;VALUE=DATE:${icsDate(addDays(g.date, 1))}`]
      : [
          `DTSTART:${icsDateTime(g.date, start)}`,
          `DTEND:${icsDateTime(g.date, start + GAME_MINUTES)}`,
        ]),
    `SUMMARY:${escapeIcsText(summary)}`,
    ...(where ? [`LOCATION:${escapeIcsText(where)}`] : []),
    ...(description ? [`DESCRIPTION:${escapeIcsText(description)}`] : []),
    ...(opts.url ? [`URL:${opts.url}`] : []),
    `STATUS:${g.status === "canceled" ? "CANCELLED" : g.status === "postponed" ? "TENTATIVE" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

// ----------------------------------------------------------------- loaders

type Client = SupabaseClient<Database>;

const GAME_COLUMNS = `id, org_id, group_id, tournament_id, opponent, kind, home_away, date, start_time,
  arrival_time, location, address, notes, status, team_score, opponent_score, line_score,
  current_inning, innings_scheduled, updated_at,
  group:player_groups (name), tournament:tournaments (name)`;

type GameRow = Database["public"]["Tables"]["games"]["Row"] & {
  group: { name: string } | null;
  tournament: { name: string } | null;
};

function toGame(r: GameRow): Game {
  return {
    id: r.id,
    orgId: r.org_id,
    groupId: r.group_id,
    groupName: r.group?.name ?? null,
    tournamentId: r.tournament_id,
    tournamentName: r.tournament?.name ?? null,
    opponent: r.opponent,
    kind: r.kind,
    homeAway: r.home_away,
    date: r.date,
    startTime: r.start_time,
    arrivalTime: r.arrival_time,
    location: r.location,
    address: r.address,
    notes: r.notes,
    status: r.status,
    teamScore: r.team_score,
    opponentScore: r.opponent_score,
    lineScore: normalizeLineScore(r.line_score),
    currentInning: r.current_inning,
    inningsScheduled: r.innings_scheduled,
    updatedAt: r.updated_at,
  };
}

const TOURNAMENT_COLUMNS =
  "id, org_id, group_id, name, start_date, end_date, location, address, url, notes, group:player_groups (name)";

type TournamentRow = Database["public"]["Tables"]["tournaments"]["Row"] & {
  group: { name: string } | null;
};

function toTournament(r: TournamentRow): Tournament {
  return {
    id: r.id,
    orgId: r.org_id,
    groupId: r.group_id,
    groupName: r.group?.name ?? null,
    name: r.name,
    startDate: r.start_date,
    endDate: r.end_date,
    location: r.location,
    address: r.address,
    url: r.url,
    notes: r.notes,
  };
}

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

/**
 * Games between `from` and `to` (inclusive; either may be null), by date and
 * start time. RLS limits players and parents to team-wide games and their
 * (child's) groups.
 */
export async function loadGames(
  supabase: Client,
  orgId: string,
  from: string | null,
  to: string | null,
  opts: {
    descending?: boolean;
    limit?: number;
    statuses?: GameStatus[];
    tournamentId?: string;
  } = {},
): Promise<Game[]> {
  let q = supabase.from("games").select(GAME_COLUMNS).eq("org_id", orgId);
  if (from) q = q.gte("date", from);
  if (to) q = q.lte("date", to);
  if (opts.statuses) q = q.in("status", opts.statuses);
  if (opts.tournamentId) q = q.eq("tournament_id", opts.tournamentId);
  const asc = !opts.descending;
  q = q
    .order("date", { ascending: asc })
    .order("start_time", { ascending: asc, nullsFirst: !asc })
    .order("created_at", { ascending: true });
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as GameRow[]).map(toGame);
}

/** One game, or null if missing / not visible to this viewer. */
export async function loadGame(supabase: Client, id: string): Promise<Game | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await supabase
    .from("games")
    .select(GAME_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toGame(data as unknown as GameRow) : null;
}

/** Tournaments overlapping [from, to] (either may be null), by start date. */
export async function loadTournaments(
  supabase: Client,
  orgId: string,
  opts: { from?: string | null; to?: string | null; descending?: boolean } = {},
): Promise<Tournament[]> {
  let q = supabase.from("tournaments").select(TOURNAMENT_COLUMNS).eq("org_id", orgId);
  if (opts.from) q = q.gte("end_date", opts.from);
  if (opts.to) q = q.lte("start_date", opts.to);
  q = q.order("start_date", { ascending: !opts.descending });
  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as TournamentRow[]).map(toTournament);
}

/** One tournament with its games, or null. */
export async function loadTournament(
  supabase: Client,
  id: string,
): Promise<{ tournament: Tournament; games: Game[] } | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await supabase
    .from("tournaments")
    .select(TOURNAMENT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const tournament = toTournament(data as unknown as TournamentRow);
  const games = await loadGames(supabase, tournament.orgId, null, null, { tournamentId: id });
  return { tournament, games };
}

/** Keep games / tournaments for the whole team or one of `groupIds`. */
export function forGroups<T extends { groupId: string | null }>(
  list: T[],
  groupIds: ReadonlySet<string> | null,
) {
  return groupIds ? list.filter((g) => !g.groupId || groupIds.has(g.groupId)) : list;
}

/** The groups a player belongs to (for parents following one child). */
export async function loadPlayerGroupIds(supabase: Client, playerId: string) {
  const { data } = await supabase
    .from("player_group_members")
    .select("group_id")
    .eq("profile_id", playerId);
  return new Set((data ?? []).map((g) => g.group_id));
}

/** The next scheduled or live game on or after `today` this viewer can see. */
export async function loadNextGame(
  supabase: Client,
  orgId: string,
  today: string,
  groupIds: ReadonlySet<string> | null = null,
) {
  const list = await loadGames(supabase, orgId, today, null, {
    statuses: ["scheduled", "live"],
    limit: 25,
  });
  return forGroups(list, groupIds)[0] ?? null;
}

/** Groups and tournaments for the game forms' pickers (staff). */
export async function loadGameFormOptions(supabase: Client, orgId: string) {
  const [{ data: groups }, { data: tournaments }] = await Promise.all([
    supabase.from("player_groups").select("id, name").eq("org_id", orgId).order("name"),
    supabase
      .from("tournaments")
      .select("id, name, start_date")
      .eq("org_id", orgId)
      .order("start_date", { ascending: false })
      .limit(50),
  ]);
  return {
    groups: groups ?? [],
    tournaments: (tournaments ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      startDate: t.start_date,
    })),
  };
}
