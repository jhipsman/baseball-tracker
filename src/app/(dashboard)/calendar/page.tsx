import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { addDays, dayOfWeek, weekStartOf } from "@/lib/schedule";
import {
  buildEntries,
  type CalendarAssignment,
  type CalendarEntry,
  type EntryStatus,
} from "@/lib/calendar";
import { DAY_OF_WEEK_LABELS, SEASON_PHASE_LABELS } from "@/constants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendar" };

const STATUS_STYLE: Record<EntryStatus, string> = {
  completed: "bg-brand-600 text-white",
  partial: "bg-amber-300 text-amber-950",
  skipped: "bg-zinc-300 text-zinc-700 line-through",
  missed: "bg-red-100 text-red-800 ring-1 ring-inset ring-red-300",
  today: "bg-white text-zinc-900 ring-2 ring-inset ring-brand-600",
  upcoming: "bg-white text-zinc-600 ring-1 ring-inset ring-zinc-300",
};
const STATUS_LABEL: Record<EntryStatus, string> = {
  completed: "Done",
  partial: "Partial",
  skipped: "Skipped",
  missed: "Missed",
  today: "Today",
  upcoming: "Upcoming",
};

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

function fmt(date: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect("/player");
  const params = await searchParams;
  const { today } = await playerToday();

  const view = params.view === "month" ? "month" : "week";
  const anchor = isDate(params.date) ? params.date : today;
  const groupId = typeof params.group === "string" ? params.group : "";

  // Visible range.
  const [y, m] = anchor.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const from = view === "week" ? weekStartOf(anchor) : weekStartOf(monthStart);
  const to = view === "week" ? addDays(from, 6) : addDays(from, 41);

  const [{ data: assignmentRows, error }, { data: players }, { data: groups }] = await Promise.all([
    supabase
      .from("program_assignments")
      .select(
        `id, player_id, status, start_date,
         program:programs!inner (id, name, org_id,
           program_weeks (week_number,
             program_days (id, name, day_number, day_of_week, session_type, sort_order)))`,
      )
      .eq("program.org_id", org.id),
    supabase
      .from("org_memberships")
      .select("profile_id, position, jersey_number, profile:profiles (full_name, email)")
      .eq("org_id", org.id)
      .eq("role", "player"),
    supabase
      .from("player_groups")
      .select("id, name, player_group_members (profile_id)")
      .eq("org_id", org.id)
      .order("name"),
  ]);
  if (error) throw error;

  const assignments: CalendarAssignment[] = assignmentRows.map((a) => ({
    id: a.id,
    playerId: a.player_id,
    status: a.status,
    startDate: a.start_date,
    programId: a.program.id,
    programName: a.program.name,
    weeks: a.program.program_weeks
      .toSorted((p, q) => p.week_number - q.week_number)
      .map((w) => ({
        days: w.program_days
          .toSorted((p, q) => p.sort_order - q.sort_order)
          .map((d) => ({
            id: d.id,
            dayOfWeek: d.day_of_week,
            name: d.name || `Day ${d.day_number}`,
            sessionType: d.session_type,
          })),
      })),
  }));

  const { data: logRows } = assignments.length
    ? await supabase
        .from("workout_logs")
        .select("program_assignment_id, program_day_id, day_name, status, date_completed")
        .in(
          "program_assignment_id",
          assignments.map((a) => a.id),
        )
        .gte("date_completed", from)
        .lte("date_completed", to)
    : { data: [] };

  const group = (groups ?? []).find((g) => g.id === groupId);
  const groupMembers = group ? new Set(group.player_group_members.map((m) => m.profile_id)) : null;
  const roster = (players ?? [])
    .filter((p) => !groupMembers || groupMembers.has(p.profile_id))
    .map((p) => ({
      id: p.profile_id,
      name: p.profile.full_name || p.profile.email,
      detail: [p.position, p.jersey_number != null ? `#${p.jersey_number}` : null]
        .filter(Boolean)
        .join(" "),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const rosterIds = new Set(roster.map((p) => p.id));

  const entries = buildEntries(
    assignments,
    (logRows ?? []).map((l) => ({
      assignmentId: l.program_assignment_id,
      dayId: l.program_day_id,
      dayName: l.day_name,
      status: l.status,
      date: l.date_completed,
    })),
    from,
    to,
    today,
  ).filter((e) => rosterIds.has(e.playerId));

  const href = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const next = { view, date: anchor, group: groupId || undefined, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) sp.set(k, v);
    return `/calendar?${sp}`;
  };
  const step = view === "week" ? 7 : 0;
  const prev = view === "week" ? addDays(anchor, -step) : shiftMonth(anchor, -1);
  const next = view === "week" ? addDays(anchor, step) : shiftMonth(anchor, 1);
  const title =
    view === "week"
      ? `${fmt(from, { month: "short", day: "numeric" })} – ${fmt(to, { month: "short", day: "numeric", year: "numeric" })}`
      : fmt(monthStart, { month: "long", year: "numeric" });

  const done = entries.filter((e) => e.status === "completed" || e.status === "partial").length;
  const due = entries.filter((e) => e.status !== "upcoming" && e.status !== "today").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {SEASON_PHASE_LABELS[org.current_season_phase]} ·{" "}
            {due > 0
              ? `${done} of ${due} due workouts logged`
              : `${entries.length} workouts scheduled`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action="/calendar" className="flex items-center gap-2">
            <input type="hidden" name="view" value={view} />
            <input type="hidden" name="date" value={anchor} />
            <label htmlFor="group" className="sr-only">
              Group
            </label>
            <select
              id="group"
              name="group"
              defaultValue={groupId}
              className="h-9 rounded-lg border-0 bg-white px-2 text-sm ring-1 ring-inset ring-zinc-300"
            >
              <option value="">All players</option>
              {(groups ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="h-9 rounded-lg px-3 text-sm font-medium ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
            >
              Filter
            </button>
          </form>
          <div className="flex rounded-lg bg-zinc-100 p-0.5 text-sm font-medium">
            {(["week", "month"] as const).map((v) => (
              <Link
                key={v}
                href={href({ view: v })}
                aria-current={v === view ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 capitalize",
                  v === view ? "bg-white shadow-sm" : "text-zinc-500 hover:text-zinc-800",
                )}
              >
                {v}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={href({ date: prev })}
          aria-label="Previous"
          className="flex size-9 items-center justify-center rounded-lg ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
        >
          ‹
        </Link>
        <Link
          href={href({ date: next })}
          aria-label="Next"
          className="flex size-9 items-center justify-center rounded-lg ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
        >
          ›
        </Link>
        <Link
          href={href({ date: today })}
          className="h-9 rounded-lg px-3 text-sm leading-9 font-medium ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
        >
          Today
        </Link>
        <h2 className="ml-2 text-lg font-semibold">{title}</h2>
      </div>

      <Legend />

      {roster.length === 0 ? (
        <p className="rounded-xl bg-white p-8 text-center text-sm text-zinc-500 ring-1 ring-zinc-200">
          {group ? `No players in ${group.name} yet.` : "No players on the roster yet."}
        </p>
      ) : view === "week" ? (
        <WeekGrid from={from} today={today} roster={roster} entries={entries} />
      ) : (
        <MonthGrid
          from={from}
          month={monthStart.slice(0, 7)}
          today={today}
          entries={entries}
          dayHref={(d) => href({ view: "week", date: d })}
        />
      )}
    </div>
  );
}

function shiftMonth(date: string, delta: number) {
  const [y, m] = date.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 10);
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-2 text-xs">
      {(Object.keys(STATUS_LABEL) as EntryStatus[]).map((s) => (
        <li key={s} className={cn("rounded px-2 py-0.5 font-medium", STATUS_STYLE[s])}>
          {STATUS_LABEL[s]}
        </li>
      ))}
    </ul>
  );
}

function Pill({ e, showProgram }: { e: CalendarEntry; showProgram: boolean }) {
  return (
    <Link
      href={`/programs/${e.programId}`}
      title={`${e.programName} · ${e.dayName} · ${STATUS_LABEL[e.status]}`}
      className={cn(
        "block truncate rounded px-1.5 py-0.5 text-xs font-medium",
        STATUS_STYLE[e.status],
      )}
    >
      {e.dayName}
      {showProgram ? <span className="opacity-70"> · {e.programName}</span> : null}
    </Link>
  );
}

function WeekGrid({
  from,
  today,
  roster,
  entries,
}: {
  from: string;
  today: string;
  roster: { id: string; name: string; detail: string }[];
  entries: CalendarEntry[];
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const byCell = new Map<string, CalendarEntry[]>();
  for (const e of entries) {
    const k = `${e.playerId}|${e.date}`;
    byCell.set(k, [...(byCell.get(k) ?? []), e]);
  }
  const programCount = new Set(entries.map((e) => e.programId)).size;

  return (
    <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-zinc-200">
      <table className="w-full min-w-[56rem] table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left">
            <th className="sticky left-0 z-10 w-48 bg-white px-3 py-2 font-semibold">Player</th>
            {days.map((d) => (
              <th
                key={d}
                className={cn(
                  "px-2 py-2 text-center font-medium",
                  d === today ? "bg-brand-50 text-brand-900" : "text-zinc-600",
                )}
              >
                {DAY_OF_WEEK_LABELS[dayOfWeek(d)]}{" "}
                <span className="tabular-nums">{Number(d.slice(8))}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roster.map((p) => {
            const mine = entries.filter((e) => e.playerId === p.id);
            const due = mine.filter((e) => e.status !== "upcoming" && e.status !== "today");
            const logged = due.filter((e) => e.status === "completed" || e.status === "partial");
            return (
              <tr key={p.id} className="border-b border-zinc-100 align-top last:border-0">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-normal"
                >
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block text-xs text-zinc-500">
                    {p.detail ? `${p.detail} · ` : ""}
                    {due.length > 0
                      ? `${logged.length}/${due.length} logged`
                      : `${mine.length} planned`}
                  </span>
                </th>
                {days.map((d) => (
                  <td
                    key={d}
                    className={cn("space-y-1 px-1.5 py-1.5", d === today && "bg-brand-50/50")}
                  >
                    {(byCell.get(`${p.id}|${d}`) ?? []).map((e) => (
                      <Pill key={e.key} e={e} showProgram={programCount > 1} />
                    ))}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MonthGrid({
  from,
  month,
  today,
  entries,
  dayHref,
}: {
  from: string;
  month: string;
  today: string;
  entries: CalendarEntry[];
  dayHref: (date: string) => string;
}) {
  const days = Array.from({ length: 42 }, (_, i) => addDays(from, i));
  const byDay = new Map<string, CalendarEntry[]>();
  for (const e of entries) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);

  return (
    <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-zinc-200">
      <div className="grid min-w-[42rem] grid-cols-7 border-b border-zinc-200 text-center text-xs font-medium text-zinc-500">
        {DAY_OF_WEEK_LABELS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid min-w-[42rem] grid-cols-7">
        {days.map((d) => {
          const list = byDay.get(d) ?? [];
          // Group by workout so a team day reads "Lower ×12 (9 done)".
          const groups = new Map<string, CalendarEntry[]>();
          for (const e of list) {
            const k = `${e.programName}|${e.dayName}`;
            groups.set(k, [...(groups.get(k) ?? []), e]);
          }
          const outside = !d.startsWith(month);
          return (
            <Link
              key={d}
              href={dayHref(d)}
              className={cn(
                "min-h-28 border-r border-b border-zinc-100 p-1.5 hover:bg-zinc-50",
                outside && "bg-zinc-50/60 text-zinc-400",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                  d === today && "bg-brand-700 text-white",
                )}
              >
                {Number(d.slice(8))}
              </span>
              <div className="mt-1 space-y-1">
                {[...groups.entries()].slice(0, 3).map(([k, g]) => {
                  const doneCount = g.filter(
                    (e) => e.status === "completed" || e.status === "partial",
                  ).length;
                  const missedCount = g.filter((e) => e.status === "missed").length;
                  return (
                    <div
                      key={k}
                      className={cn(
                        "truncate rounded px-1.5 py-0.5 text-[11px] font-medium",
                        missedCount > 0
                          ? "bg-red-50 text-red-800"
                          : doneCount === g.length
                            ? "bg-brand-50 text-brand-900"
                            : "bg-zinc-100 text-zinc-700",
                      )}
                    >
                      {g[0].dayName} ×{g.length}
                      {doneCount > 0 ? ` · ${doneCount}✓` : ""}
                      {missedCount > 0 ? ` · ${missedCount} missed` : ""}
                    </div>
                  );
                })}
                {groups.size > 3 ? (
                  <div className="text-[11px] text-zinc-500">+{groups.size - 3} more</div>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
