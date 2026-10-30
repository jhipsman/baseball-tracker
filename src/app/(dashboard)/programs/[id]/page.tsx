import type { Metadata } from "next";
import Link from "next/link";
import { formatPracticeDate } from "@/lib/practices";
import { notFound } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { loadProgramTree } from "@/lib/programs";
import { summarize } from "@/components/workout-builder/format";
import {
  DAY_OF_WEEK_LABELS,
  PROGRAM_TYPE_LABELS,
  SEASON_PHASE_LABELS,
  SESSION_LABELS,
} from "@/constants";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonClass } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { ExerciseDemo } from "@/components/exercise-demo";
import { cn } from "@/lib/utils";
import { currentWeekIndex, programOverview } from "@/lib/program-overview";
import { deleteProgram, duplicateProgram, updateAssignment } from "../actions";
import { AssignForm, EditProgramForm } from "./program-forms";

export const metadata: Metadata = { title: "Program" };

const STATUS_STYLE = {
  active: "bg-brand-50 text-brand-900",
  paused: "bg-amber-50 text-amber-800",
  completed: "bg-zinc-100 text-zinc-600",
} as const;

export default async function ProgramPage({ params, searchParams }: PageProps<"/programs/[id]">) {
  const { id } = await params;
  const { week: weekParam } = await searchParams;
  const { supabase, org, isStaff } = await requireActiveOrg();

  const program = await loadProgramTree(supabase, id);
  if (!program || program.org_id !== org.id) notFound();

  const exerciseIds = [
    ...new Set(
      program.program_weeks.flatMap((w) =>
        w.program_days.flatMap((d) => d.program_exercises.map((e) => e.exercise_id)),
      ),
    ),
  ];

  const [{ data: exercises }, { data: assignments }, { data: players }] = await Promise.all([
    exerciseIds.length
      ? supabase
          .from("exercises")
          .select("id, name, tracking_type, video_demo_url")
          .in("id", exerciseIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("program_assignments")
      .select(
        "id, start_date, status, player_id, player:profiles!program_assignments_player_id_fkey (full_name, email)",
      )
      .eq("program_id", id)
      .order("created_at", { ascending: false }),
    isStaff
      ? supabase
          .from("org_memberships")
          .select("profile_id, position, jersey_number, profile:profiles (full_name, email)")
          .eq("org_id", org.id)
          .eq("role", "player")
      : Promise.resolve({ data: [] }),
  ]);

  const exerciseById = new Map((exercises ?? []).map((e) => [e.id, e]));
  const { data: groups } = isStaff
    ? await supabase
        .from("player_groups")
        .select("id, name, player_group_members (profile_id)")
        .eq("org_id", org.id)
        .order("name")
    : { data: [] };

  // Workout logging progress per assignment.
  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const { data: logs } = assignmentIds.length
    ? await supabase
        .from("workout_logs")
        .select("program_assignment_id, status, date_completed")
        .in("program_assignment_id", assignmentIds)
    : { data: [] };
  const totalDays = program.program_weeks.reduce((n, w) => n + w.program_days.length, 0);
  const progress = new Map<string, { done: number; last: string | null }>();
  for (const l of logs ?? []) {
    const p = progress.get(l.program_assignment_id) ?? { done: 0, last: null };
    if (l.status !== "skipped") p.done += 1;
    if (!p.last || l.date_completed > p.last) p.last = l.date_completed;
    progress.set(l.program_assignment_id, p);
  }
  const activeIds = new Set(
    (assignments ?? []).filter((a) => a.status === "active").map((a) => a.player_id),
  );
  const today = new Date().toISOString().slice(0, 10);

  const overview = programOverview(
    program.program_weeks.map((w) => ({
      number: w.week_number,
      label: w.label ?? "",
      days: w.program_days.map((d) => ({
        id: d.id,
        name: d.name || `Day ${d.day_number}`,
        items: d.program_exercises.map((e) => {
          const ex = exerciseById.get(e.exercise_id);
          return {
            exerciseId: e.exercise_id,
            name: ex?.name ?? "Exercise",
            dose: summarize(
              {
                id: e.id,
                exerciseId: e.exercise_id,
                groupId: e.group_id,
                groupType: e.group_type,
                sets: e.sets,
                reps: e.reps ?? "",
                intensity: e.intensity ?? "",
                tempo: e.tempo ?? "",
                restSeconds: null,
                notes: "",
              },
              ex?.tracking_type,
            ),
            notes: e.notes ?? "",
          };
        }),
      })),
    })),
  );
  const daysPerWeek = Math.max(0, ...program.program_weeks.map((w) => w.program_days.length));
  const firstActive = (assignments ?? []).find((a) => a.status === "active");
  const thisWeek = firstActive?.start_date
    ? currentWeekIndex(firstActive.start_date, today, overview.weeks.length)
    : null;
  const requested = Number(weekParam) - 1;
  const weekIndex =
    Number.isInteger(requested) && requested >= 0 && requested < overview.weeks.length
      ? requested
      : (thisWeek ?? 0);
  const shownWeek = overview.weeks[weekIndex];
  const dayMeta = new Map(
    program.program_weeks.flatMap((w) =>
      w.program_days.map((d) => [d.id, { session: d.session_type, dow: d.day_of_week }] as const),
    ),
  );
  const facts = [
    `${program.program_weeks.length} week${program.program_weeks.length === 1 ? "" : "s"}`,
    daysPerWeek ? `${daysPerWeek} day${daysPerWeek === 1 ? "" : "s"} a week` : null,
    PROGRAM_TYPE_LABELS[program.program_type],
    program.season_phase ? SEASON_PHASE_LABELS[program.season_phase] : null,
  ].filter(Boolean);
  const assignBox = isStaff && !program.is_template;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/programs" className="text-xs font-medium text-zinc-500 hover:text-zinc-800">
            ← Programs
          </Link>
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
            {program.name}
            {program.is_template ? (
              <span className="ml-2 align-middle rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                Template
              </span>
            ) : null}
          </h1>
          <p className="mt-1 text-sm font-medium text-zinc-700">{facts.join(" · ")}</p>
          {program.description ? (
            <p className="mt-1 max-w-2xl text-sm text-zinc-500">{program.description}</p>
          ) : null}
        </div>
        {isStaff ? (
          <div className="flex flex-wrap gap-2">
            <Link href={`/programs/${id}/builder`} className={buttonClass("primary")}>
              Edit workouts
            </Link>
            <form action={duplicateProgram}>
              <input type="hidden" name="id" value={id} />
              {program.is_template ? (
                <>
                  <input type="hidden" name="as_template" value="false" />
                  <input type="hidden" name="name" value={program.name} />
                  <SubmitButton variant="secondary" pendingLabel="Creating…">
                    Use template
                  </SubmitButton>
                </>
              ) : (
                <>
                  <input type="hidden" name="as_template" value="true" />
                  <input type="hidden" name="name" value={`${program.name} (template)`} />
                  <SubmitButton variant="secondary" pendingLabel="Saving…">
                    Save as template
                  </SubmitButton>
                </>
              )}
            </form>
          </div>
        ) : null}
      </div>

      {assignBox ? (
        <section className="rounded-2xl bg-surface p-5 ring-1 ring-zinc-200">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">
              Players on this program
              {assignments?.length ? (
                <span className="ml-1.5 font-normal text-zinc-500">{assignments.length}</span>
              ) : null}
            </h2>
            {totalDays ? (
              <p className="text-xs text-zinc-500">{totalDays} workouts in the program</p>
            ) : null}
          </div>

          {assignments && assignments.length > 0 ? (
            <ul className="mt-3 divide-y divide-zinc-100">
              {assignments.map((a) => {
                const done = progress.get(a.id)?.done ?? 0;
                const last = progress.get(a.id)?.last;
                const pct = totalDays ? Math.min(100, Math.round((done / totalDays) * 100)) : 0;
                return (
                  <li key={a.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{a.player.full_name || a.player.email}</p>
                      <p className="text-xs text-zinc-500">
                        {done} of {totalDays} done
                        {last ? ` · last ${formatPracticeDate(last, { weekday: undefined })}` : ""}
                      </p>
                    </div>
                    <div
                      className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-zinc-100 sm:block"
                      role="img"
                      aria-label={`${pct}% done`}
                    >
                      <div
                        className="h-full rounded-full bg-brand-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {a.status !== "active" ? (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          STATUS_STYLE[a.status],
                        )}
                      >
                        {a.status === "paused" ? "Paused" : "Finished"}
                      </span>
                    ) : null}
                    <details className="relative">
                      <summary
                        aria-label={`Options for ${a.player.full_name || "player"}`}
                        className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
                      >
                        ⋯
                      </summary>
                      <form
                        action={updateAssignment}
                        className="absolute right-0 z-10 mt-1 flex w-40 flex-col rounded-xl bg-surface-solid p-1 text-sm shadow-lg ring-1 ring-zinc-200"
                      >
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="program_id" value={id} />
                        {a.status !== "active" ? (
                          <button
                            name="intent"
                            value="active"
                            className="rounded-lg px-3 py-2 text-left hover:bg-zinc-100"
                          >
                            Resume
                          </button>
                        ) : (
                          <>
                            <button
                              name="intent"
                              value="paused"
                              className="rounded-lg px-3 py-2 text-left hover:bg-zinc-100"
                            >
                              Pause
                            </button>
                            <button
                              name="intent"
                              value="completed"
                              className="rounded-lg px-3 py-2 text-left hover:bg-zinc-100"
                            >
                              Mark finished
                            </button>
                          </>
                        )}
                        <button
                          name="intent"
                          value="remove"
                          className="rounded-lg px-3 py-2 text-left text-red-700 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </form>
                    </details>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-zinc-500">Nobody yet. Pick players below.</p>
          )}

          <div className="mt-2">
            <Disclosure
              label="+ Assign players"
              openLabel="Hide assigning"
              defaultOpen={!assignments?.length}
            >
              <AssignForm
                programId={id}
                today={today}
                players={(players ?? []).map((p) => ({
                  id: p.profile_id,
                  name: p.profile.full_name || p.profile.email,
                  detail: [p.position, p.jersey_number != null ? `#${p.jersey_number}` : null]
                    .filter(Boolean)
                    .join(" "),
                  position: p.position,
                  assigned: activeIds.has(p.profile_id),
                }))}
                groups={(groups ?? []).map((g) => ({
                  id: g.id,
                  name: g.name,
                  memberIds: g.player_group_members.map((m) => m.profile_id),
                }))}
              />
            </Disclosure>
          </div>
        </section>
      ) : null}

      {overview.progression.length > 0 ? (
        <section className="rounded-2xl bg-surface p-5 ring-1 ring-zinc-200">
          <h2 className="font-semibold">How it builds</h2>
          <p className="text-sm text-zinc-500">
            What changes from week to week. Everything else stays the same.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500">
                  <th className="py-1.5 pr-3 font-medium" />
                  {overview.weeks.map((w, i) => (
                    <th
                      key={w.number}
                      className={cn("px-2 py-1.5 font-medium", i === thisWeek && "text-brand-700")}
                    >
                      Week {w.number}
                      {i === thisWeek ? " · now" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {overview.progression.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="py-2 pr-3 text-left font-medium">
                      {row.label}
                    </th>
                    {row.values.map((v, i) => (
                      <td
                        key={i}
                        className={cn("px-2 py-2 tabular-nums", i === thisWeek && "bg-brand-50")}
                      >
                        {v || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {shownWeek ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">
              Week {shownWeek.number}
              {shownWeek.label ? (
                <span className="font-normal text-zinc-500"> · {shownWeek.label}</span>
              ) : null}
            </h2>
            {overview.weeks.length > 1 ? (
              <nav aria-label="Weeks" className="flex flex-wrap gap-1 rounded-full bg-zinc-100 p-1">
                {overview.weeks.map((w, i) => (
                  <Link
                    key={w.number}
                    href={`/programs/${id}?week=${w.number}`}
                    scroll={false}
                    aria-current={i === weekIndex ? "page" : undefined}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm font-medium",
                      i === weekIndex
                        ? "bg-surface-solid text-zinc-900 shadow-sm"
                        : "text-zinc-600 hover:text-zinc-900",
                    )}
                  >
                    {w.number}
                    {i === thisWeek ? <span className="sr-only"> (this week)</span> : null}
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>

          {shownWeek.shared.length > 0 ? (
            <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
              <p className="text-sm font-semibold">Every session starts with</p>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
                {shownWeek.shared.map((e) => (
                  <li key={e.exerciseId} className="inline-flex items-center gap-1.5">
                    <span>
                      <span className="text-zinc-800">{e.name}</span> {e.dose}
                      {e.notes ? ` (${e.notes})` : ""}
                    </span>
                    <ExerciseDemo
                      name={e.name}
                      url={exerciseById.get(e.exerciseId)?.video_demo_url}
                      showSearch={false}
                      compact
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shownWeek.days.map((d) => {
              const meta = dayMeta.get(d.id);
              return (
                <div key={d.id} className="rounded-2xl bg-surface p-4 ring-1 ring-zinc-200">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-semibold">{d.name}</h3>
                    <span className="text-xs text-zinc-500">
                      {meta ? SESSION_LABELS[meta.session] : ""}
                      {meta?.dow != null ? ` · ${DAY_OF_WEEK_LABELS[meta.dow]}` : ""}
                    </span>
                  </div>
                  {d.total === 0 ? (
                    <p className="mt-2 text-sm text-zinc-400">No exercises yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {d.items.map((it, i) => (
                        <li key={`${it.exerciseId}-${i}`} className="flex gap-2 text-sm">
                          <span className="min-w-0 flex-1">
                            <span className="font-medium">{it.name}</span>
                            {it.dose ? <span className="text-zinc-500"> · {it.dose}</span> : null}
                            {it.notes ? (
                              <span className="block text-xs text-zinc-500">{it.notes}</span>
                            ) : null}
                          </span>
                          {/* Only exercises with a video get a button; no "find a demo" noise. */}
                          <ExerciseDemo
                            name={it.name}
                            url={exerciseById.get(it.exerciseId)?.video_demo_url}
                            showSearch={false}
                            compact
                            className="self-start"
                          />
                        </li>
                      ))}
                      {shownWeek.shared.length > 0 ? (
                        <li className="text-xs text-zinc-400">
                          + the {shownWeek.shared.length}-exercise warm-up above
                        </li>
                      ) : null}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {isStaff ? (
        <details className="rounded-xl bg-surface p-5 ring-1 ring-zinc-200">
          <summary className="cursor-pointer font-semibold">Program details</summary>
          <div className="mt-4 max-w-2xl">
            <EditProgramForm
              id={id}
              defaults={{
                name: program.name,
                description: program.description,
                program_type: program.program_type,
                season_phase: program.season_phase,
                is_template: program.is_template,
              }}
            />
          </div>
          <form action={deleteProgram} className="mt-6 border-t border-zinc-100 pt-4">
            <input type="hidden" name="id" value={id} />
            <SubmitButton variant="ghost" className="text-red-700" pendingLabel="Deleting…">
              Delete program
            </SubmitButton>
            <p className="mt-1 text-xs text-zinc-500">
              Deletes all weeks, days, and assignments for this program.
            </p>
          </form>
        </details>
      ) : null}
    </div>
  );
}
