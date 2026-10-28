import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums, Json } from "@/types/database";

// Isomorphic: pure helpers (used by the client builder) + loaders that take a
// Supabase client (RLS decides what each viewer can see).

export type PracticeKind = Enums<"practice_block_kind">;

export const PRACTICE_KINDS: { key: PracticeKind; label: string; dot: string; soft: string }[] = [
  { key: "warmup", label: "Warm-up", dot: "bg-amber-400", soft: "bg-amber-50 text-amber-900" },
  { key: "throwing", label: "Throwing", dot: "bg-sky-500", soft: "bg-sky-50 text-sky-900" },
  {
    key: "defense",
    label: "Defense",
    dot: "bg-emerald-500",
    soft: "bg-emerald-50 text-emerald-900",
  },
  { key: "hitting", label: "Hitting", dot: "bg-red-500", soft: "bg-red-50 text-red-900" },
  {
    key: "pitching",
    label: "Pitching",
    dot: "bg-violet-500",
    soft: "bg-violet-50 text-violet-900",
  },
  {
    key: "baserunning",
    label: "Baserunning",
    dot: "bg-orange-500",
    soft: "bg-orange-50 text-orange-900",
  },
  {
    key: "conditioning",
    label: "Conditioning",
    dot: "bg-rose-500",
    soft: "bg-rose-50 text-rose-900",
  },
  { key: "team", label: "Team", dot: "bg-brand-600", soft: "bg-brand-50 text-brand-900" },
  { key: "other", label: "Other", dot: "bg-zinc-400", soft: "bg-zinc-100 text-zinc-800" },
];

export const KIND_INFO = Object.fromEntries(PRACTICE_KINDS.map((k) => [k.key, k])) as Record<
  PracticeKind,
  (typeof PRACTICE_KINDS)[number]
>;

export const isPracticeKind = (v: unknown): v is PracticeKind =>
  PRACTICE_KINDS.some((k) => k.key === v);

export type Station = { name: string; coach?: string; detail?: string };

export type PracticeBlock = {
  id: string;
  kind: PracticeKind;
  title: string;
  durationMin: number;
  details: string;
  stations: Station[];
};

export type PracticePlan = {
  id: string;
  orgId: string;
  title: string;
  isTemplate: boolean;
  date: string | null;
  startTime: string | null;
  location: string | null;
  notes: string | null;
  published: boolean;
  groupId: string | null;
  groupName: string | null;
  blocks: PracticeBlock[];
};

export type PracticeSummary = Omit<PracticePlan, "blocks" | "orgId" | "notes"> & {
  blockCount: number;
  totalMin: number;
};

// ----------------------------------------------------------------- pure helpers

export const MAX_BLOCKS = 40;
export const MAX_STATIONS = 8;

/** "15:30" or "15:30:00" → minutes after midnight, or null. */
export function parseTime(value: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Minutes after midnight → "3:30" (12-hour, no suffix); wraps past midnight. */
export function formatClock(minutes: number) {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60) % 12 || 12;
  return `${h}:${String(m % 60).padStart(2, "0")}`;
}

/** Minutes after midnight → "3:30 PM". */
export function formatTime12(minutes: number) {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${formatClock(m)} ${m < 720 ? "AM" : "PM"}`;
}

/** 135 → "2h 15m", 45 → "45 min", 120 → "2h". */
export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function totalMinutes(blocks: { durationMin: number }[]) {
  return blocks.reduce((sum, b) => sum + (Number.isFinite(b.durationMin) ? b.durationMin : 0), 0);
}

export type BlockTime = { start: number; end: number; label: string };

/**
 * Start/end of each block from the plan's start time and cumulative durations.
 * Without a start time the clock counts from 0:00 (elapsed time).
 */
export function blockTimes(
  startTime: string | null | undefined,
  blocks: { durationMin: number }[],
): BlockTime[] {
  const base = parseTime(startTime);
  let cursor = base ?? 0;
  return blocks.map((b) => {
    const start = cursor;
    cursor += Math.max(0, Number.isFinite(b.durationMin) ? b.durationMin : 0);
    const label =
      base == null
        ? `${elapsed(start)}–${elapsed(cursor)}`
        : `${formatClock(start)}–${formatClock(cursor)}`;
    return { start, end: cursor, label };
  });
}

function elapsed(min: number) {
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
}

/** "3:30 PM – 5:30 PM" for the whole plan, or null without a start time. */
export function practiceRange(startTime: string | null | undefined, total: number) {
  const start = parseTime(startTime);
  if (start == null) return null;
  return `${formatTime12(start)} – ${formatTime12(start + total)}`;
}

/** Clean a stations JSON value into a list of named stations. */
export function normalizeStations(value: unknown): Station[] {
  if (!Array.isArray(value)) return [];
  const out: Station[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 80) : "";
    if (!name) continue;
    const coach = typeof r.coach === "string" ? r.coach.trim().slice(0, 80) : "";
    const detail = typeof r.detail === "string" ? r.detail.trim().slice(0, 300) : "";
    out.push({ name, ...(coach ? { coach } : {}), ...(detail ? { detail } : {}) });
    if (out.length >= MAX_STATIONS) break;
  }
  return out;
}

/** Validate builder blocks into the `save_practice_blocks` payload, or an error. */
export function toBlocksPayload(
  blocks: Omit<PracticeBlock, "id">[],
): { payload: Json[] } | { error: string } {
  if (!Array.isArray(blocks)) return { error: "Invalid blocks." };
  if (blocks.length > MAX_BLOCKS) return { error: `A plan can have at most ${MAX_BLOCKS} blocks.` };
  const payload: Json[] = [];
  for (const [i, b] of blocks.entries()) {
    const title = String(b.title ?? "")
      .trim()
      .slice(0, 120);
    const duration = Math.round(Number(b.durationMin));
    if (!title) return { error: `Block ${i + 1} needs a title.` };
    if (!Number.isFinite(duration) || duration < 1 || duration > 240) {
      return { error: `“${title}” needs 1–240 minutes.` };
    }
    payload.push({
      kind: isPracticeKind(b.kind) ? b.kind : "other",
      title,
      duration_min: duration,
      details:
        String(b.details ?? "")
          .trim()
          .slice(0, 2000) || null,
      stations: normalizeStations(b.stations) as Json,
    });
  }
  return { payload };
}

/** "Tue, Oct 28" for a YYYY-MM-DD date. */
export function formatPracticeDate(date: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...opts,
    timeZone: "UTC",
  });
}

// ----------------------------------------------------------------- loaders

type Client = SupabaseClient<Database>;

const SUMMARY_COLUMNS =
  "id, title, is_template, date, start_time, location, published, group_id, group:player_groups (name), practice_blocks (duration_min)";

type SummaryRow = {
  id: string;
  title: string;
  is_template: boolean;
  date: string | null;
  start_time: string | null;
  location: string | null;
  published: boolean;
  group_id: string | null;
  group: { name: string } | null;
  practice_blocks: { duration_min: number }[];
};

function toSummary(r: SummaryRow): PracticeSummary {
  return {
    id: r.id,
    title: r.title,
    isTemplate: r.is_template,
    date: r.date,
    startTime: r.start_time,
    location: r.location,
    published: r.published,
    groupId: r.group_id,
    groupName: r.group?.name ?? null,
    blockCount: r.practice_blocks.length,
    totalMin: r.practice_blocks.reduce((s, b) => s + b.duration_min, 0),
  };
}

/**
 * Dated practices between `from` and `to` (inclusive; either may be omitted),
 * ordered by date and start time. RLS limits non-staff to published plans
 * for their team / group.
 */
export async function loadPractices(
  supabase: Client,
  orgId: string,
  from: string | null,
  to: string | null,
  opts: { publishedOnly?: boolean; descending?: boolean; limit?: number } = {},
): Promise<PracticeSummary[]> {
  let q = supabase
    .from("practice_plans")
    .select(SUMMARY_COLUMNS)
    .eq("org_id", orgId)
    .eq("is_template", false);
  if (from) q = q.gte("date", from);
  if (to) q = q.lte("date", to);
  if (opts.publishedOnly) q = q.eq("published", true);
  const asc = !opts.descending;
  q = q.order("date", { ascending: asc }).order("start_time", { ascending: asc, nullsFirst: asc });
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as SummaryRow[]).map(toSummary);
}

export async function loadPracticeTemplates(supabase: Client, orgId: string) {
  const { data, error } = await supabase
    .from("practice_plans")
    .select(SUMMARY_COLUMNS)
    .eq("org_id", orgId)
    .eq("is_template", true)
    .order("title");
  if (error) throw error;
  return (data as unknown as SummaryRow[]).map(toSummary);
}

/** The next published practice on or after `today` that this viewer can see. */
export async function loadNextPractice(supabase: Client, orgId: string, today: string) {
  const [next] = await loadPractices(supabase, orgId, today, null, {
    publishedOnly: true,
    limit: 1,
  });
  return next ?? null;
}

/** One plan with its blocks, or null if missing / not visible to this viewer. */
export async function loadPractice(supabase: Client, id: string): Promise<PracticePlan | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await supabase
    .from("practice_plans")
    .select(
      `id, org_id, title, is_template, date, start_time, location, notes, published, group_id,
       group:player_groups (name),
       practice_blocks (id, sort_order, kind, title, duration_min, details, stations)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    orgId: data.org_id,
    title: data.title,
    isTemplate: data.is_template,
    date: data.date,
    startTime: data.start_time,
    location: data.location,
    notes: data.notes,
    published: data.published,
    groupId: data.group_id,
    groupName: data.group?.name ?? null,
    blocks: data.practice_blocks
      .toSorted((a, b) => a.sort_order - b.sort_order)
      .map((b) => ({
        id: b.id,
        kind: b.kind,
        title: b.title,
        durationMin: b.duration_min,
        details: b.details ?? "",
        stations: normalizeStations(b.stations),
      })),
  };
}
