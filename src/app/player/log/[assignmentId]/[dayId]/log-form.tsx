"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  CATEGORY_DOT,
  DISTANCE_UNITS,
  GROUP_LABELS,
  type DistanceUnit,
  type ExerciseCategory,
  type TrackingType,
} from "@/constants";
import type { Enums } from "@/types/database";
import { ExerciseDemo } from "@/components/exercise-demo";
import {
  bestTime,
  formatSeconds,
  formatSets,
  isDistanceUnit,
  parseDistance,
  type LoggedSet,
} from "@/lib/sets-format";
import { formatGameDate } from "@/lib/games";
import { cn } from "@/lib/utils";
import { saveWorkoutLog } from "./actions";

export type LogItem = {
  programExerciseId: string;
  name: string;
  category: ExerciseCategory | null;
  trackingType: TrackingType;
  videoUrl: string | null;
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

type SetRow = {
  reps: string;
  weight: string;
  rpe: string;
  time: string;
  distance: string;
  done: boolean;
};
type ExState = { sets: SetRow[]; notes: string; showNotes: boolean; unit: DistanceUnit };
type Field = Exclude<keyof SetRow, "done">;

const cellInput =
  "h-12 w-full min-w-0 rounded-lg border-0 bg-surface px-2 text-center text-base tabular-nums ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-600";

/** Which inputs each tracking type shows, left to right. */
function columnsFor(type: TrackingType, unit: DistanceUnit) {
  const reps = { field: "reps", label: "Reps", aria: "reps", mode: "numeric" } as const;
  const weight = {
    field: "weight",
    label: "Weight (lb)",
    aria: "weight",
    mode: "decimal",
  } as const;
  const rpe = { field: "rpe", label: "RPE", aria: "RPE", mode: "decimal" } as const;
  const time = { field: "time", label: "Time (sec)", aria: "time", mode: "decimal" } as const;
  const distance = {
    field: "distance",
    label: `Distance (${unit})`,
    aria: "distance",
    mode: "decimal",
  } as const;
  switch (type) {
    case "weight_reps":
      return [reps, weight, rpe];
    case "reps":
      return [reps];
    case "time":
      return [time];
    case "distance":
      return [distance];
    case "distance_time":
      return [distance, time];
  }
}

function firstInt(s: string) {
  const m = /^\s*(\d+)/.exec(s);
  return m ? m[1] : "";
}

/** "7,12" → 7.12 (phones in some locales type commas). Empty/invalid → null. */
function toNumber(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const str = (v: unknown) => (v == null ? "" : String(v));

const emptyRow = (): SetRow => ({
  reps: "",
  weight: "",
  rpe: "",
  time: "",
  distance: "",
  done: false,
});

/** Fill in fields missing from drafts saved before time/distance tracking existed. */
function normalizeExState(raw: Partial<ExState> | undefined, fallback: ExState): ExState {
  if (!raw || !Array.isArray(raw.sets)) return fallback;
  return {
    sets: raw.sets.map((r) => ({ ...emptyRow(), ...r, done: Boolean(r?.done) })),
    notes: typeof raw.notes === "string" ? raw.notes : "",
    showNotes: Boolean(raw.showNotes),
    unit: isDistanceUnit(raw.unit) ? raw.unit : fallback.unit,
  };
}

function initialUnit(item: LogItem, existing?: { sets: LoggedSet[] }): DistanceUnit {
  const logged = existing?.sets.find((s) => isDistanceUnit(s.distance_unit))?.distance_unit;
  if (logged) return logged;
  const prescribed = parseDistance(item.prescribedReps)?.unit;
  if (prescribed) return prescribed;
  const last = item.lastTime?.sets.find((s) => isDistanceUnit(s.distance_unit))?.distance_unit;
  return last ?? "yd";
}

function initialSets(item: LogItem, existing?: { sets: LoggedSet[] }): SetRow[] {
  if (existing && existing.sets.length > 0) {
    return existing.sets.map((s) => ({
      reps: str(s.reps),
      weight: str(s.weight),
      rpe: str(s.rpe),
      time: str(s.time_s),
      distance: str(s.distance),
      done: s.done !== false,
    }));
  }
  const count = Math.max(1, Math.min(item.prescribedSets ?? 1, 20));
  const type = item.trackingType;
  const usesReps = type === "weight_reps" || type === "reps";
  const usesDistance = type === "distance" || type === "distance_time";
  const prescribedDistance = usesDistance ? parseDistance(item.prescribedReps)?.value : undefined;
  return Array.from({ length: count }, (_, i) => ({
    ...emptyRow(),
    reps: usesReps ? firstInt(item.prescribedReps) : "",
    // Start from what they lifted last time for the same set.
    weight:
      type === "weight_reps" && item.lastTime?.sets[i]?.weight != null
        ? String(item.lastTime.sets[i].weight)
        : "",
    distance: prescribedDistance != null ? String(prescribedDistance) : "",
  }));
}

function toLoggedSet(
  row: SetRow,
  index: number,
  type: TrackingType,
  unit: DistanceUnit,
): LoggedSet {
  const set: LoggedSet = { set: index + 1, reps: null, weight: null, rpe: null, done: row.done };
  if (type === "weight_reps" || type === "reps") {
    set.reps = /^\d+$/.test(row.reps.trim()) ? Number(row.reps) : row.reps.trim() || null;
  }
  if (type === "weight_reps") {
    set.weight = toNumber(row.weight);
    set.rpe = toNumber(row.rpe);
  }
  if (type === "time" || type === "distance_time") set.time_s = toNumber(row.time);
  if (type === "distance" || type === "distance_time") {
    set.distance = toNumber(row.distance);
    set.distance_unit = unit;
  }
  return set;
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
            unit: initialUnit(it, prev),
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
        state: Record<string, Partial<ExState>>;
        duration: string;
        rpe: number | null;
        notes: string;
      };
      const known = Object.keys(draft.state ?? {}).filter((k) => k in state);
      if (known.length === 0) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore after mount
      setState((s) => ({
        ...s,
        ...Object.fromEntries(known.map((k) => [k, normalizeExState(draft.state[k], s[k])])),
      }));
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
    const exercises = items.map((it, i) => {
      const ex = state[it.programExerciseId];
      return {
        programExerciseId: it.programExerciseId,
        sortOrder: i,
        notes: ex.notes,
        sets:
          status === "skipped"
            ? []
            : ex.sets.map((row, j) => toLoggedSet(row, j, it.trackingType, ex.unit)),
      };
    });
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

  // A day with nothing to tick off (e.g. practice) counts as completed.
  const finishStatus = done === total ? "completed" : "partial";

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
          const type = it.trackingType;
          const cols = columnsFor(type, ex.unit);
          const grid = {
            gridTemplateColumns: `1.5rem repeat(${cols.length}, minmax(0, 1fr)) 3rem`,
          };
          const last = it.lastTime ? formatSets(it.lastTime.sets, type) : "";
          // Sprints: lower is better. Flag a new best against last time.
          const lastBest =
            type === "time" && (it.category === "speed" || it.category === "conditioning")
              ? bestTime(it.lastTime?.sets)
              : null;
          const nowBest =
            lastBest != null ? bestTime(ex.sets.map((r) => ({ time_s: toNumber(r.time) }))) : null;
          return (
            <li
              key={it.programExerciseId}
              className={cn(
                "rounded-2xl bg-surface p-4 ring-1 ring-zinc-200",
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
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="flex min-w-0 items-center gap-2 font-semibold">
                      {it.category ? (
                        <span
                          aria-hidden
                          className={cn("size-2 shrink-0 rounded-full", CATEGORY_DOT[it.category])}
                        />
                      ) : null}
                      {it.name}
                    </h2>
                    <ExerciseDemo name={it.name} url={it.videoUrl} className="mt-[-2px]" />
                  </div>
                  {it.prescription ? (
                    <p className="text-sm text-zinc-600">{it.prescription}</p>
                  ) : null}
                  {it.coachNotes ? (
                    <p className="mt-1 text-sm text-zinc-500 italic">“{it.coachNotes}”</p>
                  ) : null}
                  {it.lastTime && last ? (
                    <p className="mt-1 text-sm text-zinc-600 tabular-nums">
                      <span className="font-medium text-zinc-800">Last time</span> (
                      {formatGameDate(it.lastTime.date)}): {last}
                    </p>
                  ) : null}
                  {it.instructions ? (
                    <details className="mt-1 text-sm text-zinc-600">
                      <summary className="w-fit cursor-pointer py-3 font-medium">How to</summary>
                      <p className="mb-1">{it.instructions}</p>
                    </details>
                  ) : null}
                </div>
              </div>

              {type === "distance" || type === "distance_time" ? (
                <label className="mt-3 flex items-center justify-end gap-2 text-xs text-zinc-500">
                  Unit
                  <select
                    aria-label={`${it.name} distance unit`}
                    value={ex.unit}
                    onChange={(e) =>
                      updateEx(it.programExerciseId, { unit: e.target.value as DistanceUnit })
                    }
                    className="h-9 rounded-lg border-0 bg-surface px-2 text-base text-zinc-900 ring-1 ring-inset ring-zinc-300"
                  >
                    {DISTANCE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="mt-3 grid items-center gap-2 text-xs text-zinc-500" style={grid}>
                <span />
                {cols.map((c) => (
                  <span key={c.field} className="text-center">
                    {c.label}
                  </span>
                ))}
                <span className="sr-only">Done</span>
              </div>
              <div className="mt-1 space-y-2">
                {ex.sets.map((row, i) => (
                  <div key={i} className="grid items-center gap-2" style={grid}>
                    <span className="text-center text-sm font-semibold text-zinc-400 tabular-nums">
                      {i + 1}
                    </span>
                    {cols.map((c) => (
                      <input
                        key={c.field}
                        aria-label={`${it.name} set ${i + 1} ${c.aria}`}
                        className={cellInput}
                        inputMode={c.mode}
                        placeholder={
                          c.field === "reps"
                            ? it.prescribedReps || "–"
                            : c.field === "time"
                              ? "sec"
                              : "–"
                        }
                        value={row[c.field as Field]}
                        onChange={(e) =>
                          updateSet(it.programExerciseId, i, { [c.field]: e.target.value })
                        }
                      />
                    ))}
                    <button
                      type="button"
                      aria-pressed={row.done}
                      aria-label={`Mark ${it.name} set ${i + 1} done`}
                      onClick={() => updateSet(it.programExerciseId, i, { done: !row.done })}
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-lg text-xl font-bold",
                        row.done
                          ? "bg-brand-700 text-on-brand"
                          : "bg-zinc-100 text-zinc-400 ring-1 ring-inset ring-zinc-200",
                      )}
                    >
                      ✓
                    </button>
                  </div>
                ))}
              </div>
              {lastBest != null && nowBest != null && nowBest < lastBest ? (
                <p className="mt-2 text-sm font-semibold text-brand-700">
                  New best: {formatSeconds(nowBest)} (was {formatSeconds(lastBest)})
                </p>
              ) : null}

              <div className="mt-2 flex flex-wrap items-center gap-x-1 text-sm">
                <button
                  type="button"
                  className="-ml-2 h-11 rounded-lg px-2 font-semibold text-brand-700 active:bg-brand-50"
                  onClick={() => {
                    const prev = ex.sets.at(-1);
                    updateEx(it.programExerciseId, {
                      sets: [
                        ...ex.sets,
                        {
                          ...emptyRow(),
                          // Carry the prescription forward, but never a time.
                          reps: prev?.reps ?? "",
                          weight: prev?.weight ?? "",
                          distance: prev?.distance ?? "",
                        },
                      ],
                    });
                  }}
                >
                  + Add set
                </button>
                <button
                  type="button"
                  className="h-11 rounded-lg px-2 font-medium text-zinc-600 active:bg-zinc-100"
                  onClick={() => updateEx(it.programExerciseId, { showNotes: !ex.showNotes })}
                >
                  {ex.showNotes ? "Hide note" : "Add note"}
                </button>
                {/* Kept apart from "+ Add set" so a sweaty thumb doesn't drop a set. */}
                {ex.sets.length > 1 ? (
                  <button
                    type="button"
                    className="-mr-2 ml-auto h-11 rounded-lg px-2 font-medium text-zinc-500 active:bg-zinc-100"
                    onClick={() => updateEx(it.programExerciseId, { sets: ex.sets.slice(0, -1) })}
                  >
                    Remove set
                  </button>
                ) : null}
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

      <section className="space-y-4 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200">
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
                    ? "bg-brand-700 text-on-brand"
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

      <div className="sticky bottom-20 z-10 space-y-2 rounded-2xl bg-surface-solid/95 p-3 shadow-lg ring-1 ring-zinc-200 backdrop-blur">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {total > 0 ? `${done}/${total} sets done` : "Session"}
          </span>
          <span className="text-zinc-500">
            {finishStatus === "completed"
              ? "Ready to finish"
              : done === 0
                ? "Tap ✓ after each set"
                : "Will save as partial"}
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
            className="h-14 flex-1 rounded-xl bg-brand-700 text-base font-semibold text-on-brand disabled:opacity-60"
          >
            {pending ? "Saving…" : existing ? "Update workout" : "Finish workout"}
          </button>
        </div>
      </div>
    </div>
  );
}
