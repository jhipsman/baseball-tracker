import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { loadProgramTree } from "@/lib/programs";
import { blockLabels } from "@/components/workout-builder/reducer";
import { summarize } from "@/components/workout-builder/format";
import {
  DAY_OF_WEEK_LABELS,
  GROUP_LABELS,
  PROGRAM_TYPE_LABELS,
  SEASON_PHASE_LABELS,
  SESSION_LABELS,
} from "@/constants";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { deleteProgram, duplicateProgram, updateAssignment } from "../actions";
import { AssignForm, EditProgramForm } from "./program-forms";

export const metadata: Metadata = { title: "Program" };

const STATUS_STYLE = {
  active: "bg-brand-50 text-brand-900",
  paused: "bg-amber-50 text-amber-800",
  completed: "bg-zinc-100 text-zinc-600",
} as const;

export default async function ProgramPage({ params }: PageProps<"/programs/[id]">) {
  const { id } = await params;
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
      ? supabase.from("exercises").select("id, name").in("id", exerciseIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
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

  const names = new Map((exercises ?? []).map((e) => [e.id, e.name]));
  const activeIds = new Set(
    (assignments ?? []).filter((a) => a.status === "active").map((a) => a.player_id),
  );
  const today = new Date().toISOString().slice(0, 10);
  const totalExercises = program.program_weeks.reduce(
    (n, w) => n + w.program_days.reduce((m, d) => m + d.program_exercises.length, 0),
    0,
  );

  return (
    <div className="max-w-6xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/programs" className="text-xs font-medium text-zinc-500 hover:text-zinc-800">
            ← Programs
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{program.name}</h1>
          {program.description ? (
            <p className="mt-1 max-w-2xl text-sm text-zinc-600">{program.description}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {program.is_template ? (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800">
                Template
              </span>
            ) : null}
            <span className="rounded bg-brand-50 px-1.5 py-0.5 font-medium text-brand-900">
              {PROGRAM_TYPE_LABELS[program.program_type]}
            </span>
            {program.season_phase ? (
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700">
                {SEASON_PHASE_LABELS[program.season_phase]}
              </span>
            ) : null}
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700">
              {program.program_weeks.length} weeks · {totalExercises} exercises
            </span>
          </div>
        </div>
        {isStaff ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/programs/${id}/builder`}
              className="inline-flex h-11 items-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-600"
            >
              Open builder
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

      {/* Structure */}
      <section className="space-y-4">
        {program.program_weeks.map((w) => (
          <div key={w.id}>
            <h2 className="mb-2 text-sm font-semibold text-zinc-700">
              Week {w.week_number}
              {w.label ? <span className="font-normal text-zinc-500"> · {w.label}</span> : null}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {w.program_days.map((d) => {
                const items = d.program_exercises.map((e) => ({
                  id: e.id,
                  exerciseId: e.exercise_id,
                  groupId: e.group_id,
                  groupType: e.group_type,
                  sets: e.sets,
                  reps: e.reps ?? "",
                  intensity: e.intensity ?? "",
                  tempo: e.tempo ?? "",
                  restSeconds: e.rest_seconds,
                  notes: e.notes ?? "",
                }));
                const labels = blockLabels(items);
                return (
                  <div key={d.id} className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-medium">{d.name || `Day ${d.day_number}`}</h3>
                      <span className="text-xs text-zinc-500">
                        {SESSION_LABELS[d.session_type]}
                        {d.day_of_week != null ? ` · ${DAY_OF_WEEK_LABELS[d.day_of_week]}` : ""}
                      </span>
                    </div>
                    {items.length === 0 ? (
                      <p className="mt-2 text-sm text-zinc-400">No exercises yet.</p>
                    ) : (
                      <ol className="mt-2 space-y-1.5">
                        {items.map((it, i) => (
                          <li
                            key={it.id}
                            className={cn(
                              "flex gap-2 text-sm",
                              it.groupId && "border-l-2 border-zinc-300 pl-2",
                            )}
                          >
                            <span className="w-6 shrink-0 text-xs font-semibold text-zinc-400 tabular-nums">
                              {labels[i]}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-medium">
                                {names.get(it.exerciseId) ?? "Exercise"}
                                {it.groupType && items[i - 1]?.groupId !== it.groupId ? (
                                  <span className="ml-1.5 text-[10px] font-semibold tracking-wide text-zinc-400 uppercase">
                                    {GROUP_LABELS[it.groupType]}
                                  </span>
                                ) : null}
                              </span>
                              <span className="block text-xs text-zinc-500">{summarize(it)}</span>
                              {it.notes ? (
                                <span className="block text-xs text-zinc-500 italic">
                                  {it.notes}
                                </span>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {isStaff && !program.is_template ? (
        <section className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
          <h2 className="mb-4 font-semibold">Assign to players</h2>
          <AssignForm
            programId={id}
            today={today}
            players={(players ?? []).map((p) => ({
              id: p.profile_id,
              name: p.profile.full_name || p.profile.email,
              detail: [p.position, p.jersey_number != null ? `#${p.jersey_number}` : null]
                .filter(Boolean)
                .join(" "),
              assigned: activeIds.has(p.profile_id),
            }))}
          />

          {assignments && assignments.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-zinc-700">Assignments</h3>
              <ul className="mt-2 divide-y divide-zinc-100">
                {assignments.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {a.player.full_name || a.player.email}
                    </span>
                    <span className="text-zinc-500">from {a.start_date}</span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-xs font-medium",
                        STATUS_STYLE[a.status],
                      )}
                    >
                      {a.status}
                    </span>
                    <form action={updateAssignment} className="flex gap-1">
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="program_id" value={id} />
                      {a.status !== "active" ? (
                        <button
                          name="intent"
                          value="active"
                          className="text-xs font-semibold text-zinc-600 hover:text-zinc-900"
                        >
                          Resume
                        </button>
                      ) : (
                        <>
                          <button
                            name="intent"
                            value="paused"
                            className="text-xs font-semibold text-zinc-600 hover:text-zinc-900"
                          >
                            Pause
                          </button>
                          <button
                            name="intent"
                            value="completed"
                            className="text-xs font-semibold text-zinc-600 hover:text-zinc-900"
                          >
                            Complete
                          </button>
                        </>
                      )}
                      <button
                        name="intent"
                        value="remove"
                        className="text-xs font-semibold text-zinc-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {isStaff ? (
        <details className="rounded-xl bg-white p-5 ring-1 ring-zinc-200">
          <summary className="cursor-pointer font-semibold">Edit details</summary>
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
