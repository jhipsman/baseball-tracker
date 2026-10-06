"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CATEGORY_DOT, GROUP_LABELS, type ExerciseCategory } from "@/constants";
import type { Enums } from "@/types/database";
import { cn } from "@/lib/utils";
import { saveWorkoutLog, type LoggedSet } from "./actions";

export type LogItem = {
  programExerciseId: string;
  name: string;
  category: ExerciseCategory | null;
  label: string;
  groupType: Enums<"exercise_group_type"> | null;
  groupStart: boolean;
  prescription: string;
  coachNotes: string | null;
  instructions: string | null;
  prescribedSets: number | null;
  prescribedReps: string;
  lastTime: { date: string; sets: LoggedSet[] } | null;
};

export type ExistingLog = {
  status: Enums<"workout_status">;
  durationMinutes: number | null;
  overallRpe: number | null;
  notes: string;
  date: string;
  exercises: Record<string, { sets: LoggedSet[]; notes: string }>;
};

type SetRow = { reps: string; weight: string; rpe: string; done: boolean };
type ExState = { sets: SetRow[]; notes: string; showNotes: boolean };

const cellInput =
  "h-12 w-full min-w-0 rounded-lg border-0 bg-white px-2 text-center text-base tabular-nums ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-600";

function firstInt(s: string) {
  const m = /^\s*(\d+)/.exec(s);
  return m ? m[1] : "";
}

function initialSets(item: LogItem, existing?: { sets: LoggedSet[] }): SetRow[] {
  if (existing && existing.sets.length > 0) {
    return existing.sets.map((s) => ({
      reps: s.reps == null ? "" : String(s.reps),
      weight: s.weight == null ? "" : String(s.weight),
      rpe: s.rpe == null ? "" : String(s.rpe),
      done: s.done !== false,
    }));
  }
  const count = Math.max(1, Math.min(item.prescribedSets ?? 1, 20));
  return Array.from({ length: count }, (_, i) => ({
    reps: firstInt(item.prescribedReps),
    // Start from what they lifted last time for the same set.
    weight: item.lastTime?.sets[i]?.weight != null ? String(item.lastTime.sets[i].weight) : "",
    rpe: "",
    done: false,
  }));
}

function formatLast(sets: LoggedSet[]) {
  return sets
    .filter((s) => s.reps != null || s.weight != null)
    .map((s) => (s.weight != null ? `${s.weight}×${s.reps ?? "–"}` : `${s.reps}`))
    .join(", ");
}

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function LogForm({
  assignmentId,
  dayId,
  items,
  existing,
}: {
  assignmentId: string;
  dayId: string;
  items: LogItem[];
  existing: ExistingLog | null;
}) {
  const draftKey = `dp-log:${assignmentId}:${dayId}`;
  const [state, setState] = useState<Record<string, ExState>>(() =>
    Object.fromEntries(
      items.map((it) => {
        const prev = existing?.exercises[it.programExerciseId];
        return [
          it.programExerciseId,
          {
            sets: initialSets(it, prev),
            notes: prev?.notes ?? "",
            showNotes: Boolean(prev?.notes),
          },
        ];
      }),
    ),
  );
  const [duration, setDuration] = useState(existing?.durationMinutes?.toString() ?? "");
  const [rpe, setRpe] = useState<number | null>(existing?.overallRpe ?? null);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [restored, setRestored] = useState(false);
  const hydrated = useRef(false);

  // Restore an unsaved draft (phones often reload backgrounded tabs mid-workout).
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    try {
      if (existing) {
        // Already saved on the server; any local draft is stale.
        localStorage.removeItem(draftKey);
        return;
      }
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        state: Record<string, ExState>;
        duration: string;
        rpe: number | null;
        notes: string;
      };
      const known = Object.keys(draft.state ?? {}).filter((k) => k in state);
      if (known.length === 0) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore after mount
      setState((s) => ({ ...s, ...Object.fromEntries(known.map((k) => [k, draft.state[k]])) }));
      setDuration(draft.duration ?? "");
      setRpe(draft.rpe ?? null);
      setNotes(draft.notes ?? "");
      setRestored(true);
    } catch {
      // ignore unreadable drafts
    }
  }, [draftKey, existing, state]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ state, duration, rpe, notes }));
    } catch {
      // storage unavailable (private mode); drafts are a convenience only
    }
  }, [draftKey, state, duration, rpe, notes]);

  const { done, total } = useMemo(() => {
    const all = Object.values(state).flatMap((e) => e.sets);
    return { done: all.filter((s) => s.done).length, total: all.length };
  }, [state]);

  const updateSet = (id: string, i: number, patch: Partial<SetRow>) =>
    setState((s) => ({
      ...s,
      [id]: { ...s[id], sets: s[id].sets.map((row, j) => (j === i ? { ...row, ...patch } : row)) },
    }));
  const updateEx = (id: string, patch: Partial<ExState>) =>
    setState((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

  function submit(status: Enums<"workout_status">) {
    setError(null);
    const exercises = items.map((it, i) => ({
      programExerciseId: it.programExerciseId,
      sortOrder: i,
      notes: state[it.programExerciseId].notes,
      sets:
        status === "skipped"
          ? []
          : state[it.programExerciseId].sets.map((row, j) => ({
              set: j + 1,
              reps: /^\d+$/.test(row.reps.trim()) ? Number(row.reps) : row.reps.trim() || null,
              weight: row.weight.trim() === "" ? null : Number(row.weight),
              rpe: row.rpe.trim() === "" ? null : Number(row.rpe),
              done: row.done,
            })),
    }));
    startTransition(async () => {
      const result = await saveWorkoutLog({
        assignmentId,
        dayId,
        date: existing?.date ?? localDate(),
        status,
        durationMinutes: duration ? Number(duration) : null,
        overallRpe: rpe,
        notes,
        exercises,
      });
      // On success the action redirects; we only get here on error.
      if (result?.error) setError(result.error);
    });
  }

  const finishStatus = done === total && total > 0 ? "completed" : "partial";

  return (
    <div className="space-y-4">
      {restored ? (
        <p className="rounded-xl bg-brand-50 px-4 py-2 text-sm text-brand-900">
          Restored your unsaved progress.
        </p>
      ) : null}

      <ol className="space-y-3">
        {items.map((it) => {
          const ex = state[it.programExerciseId];
          return (
            <li
              key={it.programExerciseId}
              className={cn(
                "rounded-2xl bg-white p-4 ring-1 ring-zinc-200",
                it.groupType && "border-l-4 border-l-sky-500",
              )}
            >
              {it.groupStart && it.groupType ? (
                <p className="mb-1 text-[11px] font-semibold tracking-wide text-sky-700 uppercase">
                  {GROUP_LABELS[it.groupType]}
                </p>
              ) : null}
              <div className="flex items-start gap-2">
                <span className="mt-0.5 w-7 shrink-0 text-sm font-semibold text-zinc-400 tabular-nums">
                  {it.label}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-2 font-semibold">
                    {it.category ? (
                      <span
                        aria-hidden
                        className={cn("size-2 shrink-0 rounded-full", CATEGORY_DOT[it.category])}
                      />
                    ) : null}
                    {it.name}
                  </h2>
                  {it.prescription ? (
                    <p className="text-sm text-zinc-600">{it.prescription}</p>
                  ) : null}
                  {it.coachNotes ? (
                    <p className="mt-1 text-sm text-zinc-500 italic">“{it.coachNotes}”</p>
                  ) : null}
                  {it.lastTime && formatLast(it.lastTime.sets) ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      Last time ({it.lastTime.date}): {formatLast(it.lastTime.sets)}
                    </p>
                  ) : null}
                  {it.instructions ? (
                    <details className="mt-1 text-xs text-zinc-500">
                      <summary className="cursor-pointer">How to</summary>
                      <p className="mt-1">{it.instructions}</p>
                    </details>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-[1.5rem_1fr_1fr_1fr_3rem] items-center gap-2 text-xs text-zinc-500">
                <span />
                <span className="text-center">Reps</span>
                <span className="text-center">Weight (lb)</span>
                <span className="text-center">RPE</span>
                <span className="sr-only">Done</span>
              </div>
              <div className="mt-1 space-y-2">
                {ex.sets.map((row, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1.5rem_1fr_1fr_1fr_3rem] items-center gap-2"
                  >
                    <span className="text-center text-sm font-semibold text-zinc-400 tabular-nums">
                      {i + 1}
                    </span>
                    <input
                      aria-label={`${it.name} set ${i + 1} reps`}
                      className={cellInput}
                      inputMode="numeric"
                      placeholder={it.prescribedReps || "–"}
                      value={row.reps}
                      onChange={(e) => updateSet(it.programExerciseId, i, { reps: e.target.value })}
                    />
                    <input
                      aria-label={`${it.name} set ${i + 1} weight`}
                      className={cellInput}
                      inputMode="decimal"
                      placeholder="–"
                      value={row.weight}
                      onChange={(e) =>
                        updateSet(it.programExerciseId, i, { weight: e.target.value })
                      }
                    />
                    <input
                      aria-label={`${it.name} set ${i + 1} RPE`}
                      className={cellInput}
                      inputMode="decimal"
                      placeholder="–"
                      value={row.rpe}
                      onChange={(e) => updateSet(it.programExerciseId, i, { rpe: e.target.value })}
                    />
                    <button
                      type="button"
                      aria-pressed={row.done}
                      aria-label={`Mark ${it.name} set ${i + 1} done`}
                      onClick={() => updateSet(it.programExerciseId, i, { done: !row.done })}
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-lg text-xl font-bold",
                        row.done
                          ? "bg-brand-700 text-white"
                          : "bg-zinc-100 text-zinc-400 ring-1 ring-inset ring-zinc-200",
                      )}
                    >
                      ✓
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <button
                  type="button"
                  className="font-semibold text-brand-700"
                  onClick={() => {
                    const last = ex.sets.at(-1);
                    updateEx(it.programExerciseId, {
                      sets: [
                        ...ex.sets,
                        {
                          reps: last?.reps ?? "",
                          weight: last?.weight ?? "",
                          rpe: "",
                          done: false,
                        },
                      ],
                    });
                  }}
                >
                  + Add set
                </button>
                {ex.sets.length > 1 ? (
                  <button
                    type="button"
                    className="font-medium text-zinc-500"
                    onClick={() => updateEx(it.programExerciseId, { sets: ex.sets.slice(0, -1) })}
                  >
                    Remove set
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ml-auto font-medium text-zinc-500"
                  onClick={() => updateEx(it.programExerciseId, { showNotes: !ex.showNotes })}
                >
                  {ex.showNotes ? "Hide note" : "Add note"}
                </button>
              </div>
              {ex.showNotes ? (
                <textarea
                  aria-label={`${it.name} notes`}
                  rows={2}
                  value={ex.notes}
                  onChange={(e) => updateEx(it.programExerciseId, { notes: e.target.value })}
                  placeholder="How did it feel? Any pain?"
                  className="mt-2 block w-full rounded-lg border-0 px-3 py-2 text-base ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-brand-600"
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
        <h2 className="font-semibold">Wrap up</h2>
        <fieldset>
          <legend className="text-sm font-medium text-zinc-800">
            How hard was it overall? (RPE)
          </legend>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={rpe === n}
                onClick={() => setRpe(rpe === n ? null : n)}
                className={cn(
                  "h-12 rounded-lg text-base font-semibold tabular-nums",
                  rpe === n
                    ? "bg-brand-700 text-white"
                    : "bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-200",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-medium text-zinc-800">
          Duration (minutes)
          <input
            inputMode="numeric"
            value={duration}
            onChange={(e) => setDuration(e.target.value.replace(/\D/g, "").slice(0, 3))}
            className="mt-1 block h-12 w-32 rounded-lg border-0 px-3 text-base ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-brand-600"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-800">
          Notes for your coach
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 block w-full rounded-lg border-0 px-3 py-2 text-base ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-brand-600"
          />
        </label>
      </section>

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-20 z-10 space-y-2 rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-zinc-200 backdrop-blur">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {done}/{total} sets done
          </span>
          <span className="text-zinc-500">
            {finishStatus === "completed" ? "Ready to finish" : "Will save as partial"}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full bg-brand-500 transition-all"
            style={{ width: `${total ? (done / total) * 100 : 0}%` }}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm("Skip this workout?")) submit("skipped");
            }}
            className="h-14 rounded-xl px-4 text-sm font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-300 disabled:opacity-50"
          >
            Skip
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => submit(finishStatus)}
            className="h-14 flex-1 rounded-xl bg-brand-700 text-base font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : existing ? "Update workout" : "Finish workout"}
          </button>
        </div>
      </div>
    </div>
  );
}
