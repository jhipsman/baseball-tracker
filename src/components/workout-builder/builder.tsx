"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { GROUP_LABELS, EXERCISE_GROUP_TYPES } from "@/constants";
import { cn } from "@/lib/utils";
import { DayColumn } from "./day-column";
import { ExerciseCardBody } from "./exercise-row";
import { LibraryPanel } from "./library-panel";
import { builderReducer, findItem, toPayload, type BuilderAction } from "./reducer";
import type { BuilderItem, BuilderState, BuilderWeek, LibraryExercise } from "./types";

export type SaveResult = { error?: string };
type SaveFn = (programId: string, weeks: ReturnType<typeof toPayload>) => Promise<SaveResult>;
type SaveStatus = "saved" | "dirty" | "saving" | "error";

const AUTOSAVE_MS = 1000;

/** Prefer exercise rows under the pointer; fall back to the day column, then nearest. */
const collisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  if (within.length > 0) {
    const items = within.filter((c) => c.data?.droppableContainer?.data.current?.type === "item");
    return items.length > 0 ? items : within;
  }
  return closestCorners(args);
};

type DragData = { type: "library"; exerciseId: string } | { type: "item"; dayId: string };

export function WorkoutBuilder({
  programId,
  programName,
  initialWeeks,
  library,
  save,
}: {
  programId: string;
  programName: string;
  initialWeeks: BuilderWeek[];
  library: LibraryExercise[];
  save: SaveFn;
}) {
  const [state, dispatch] = useReducer(builderReducer, {
    weeks: initialWeeks,
    activeWeek: 0,
    selection: [],
  } satisfies BuilderState);
  const { weeks, activeWeek, selection } = state;
  const week = weeks[activeWeek];

  const exercisesById = useMemo(() => new Map(library.map((e) => [e.id, e])), [library]);

  // ---------------------------------------------------------------- target day
  const [targetDayId, setTargetDayId] = useState<string | null>(week?.days[0]?.id ?? null);
  const targetDay = week?.days.find((d) => d.id === targetDayId) ?? week?.days[0];
  const focusDay = useCallback((id: string) => setTargetDayId(id), []);

  const addToTarget = useCallback(
    (exerciseId: string) => {
      if (targetDay) dispatch({ type: "addExercise", dayId: targetDay.id, exerciseId });
    },
    [targetDay],
  );

  // ---------------------------------------------------------------- autosave
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const latestWeeks = useRef(weeks);
  const saving = useRef(false);
  const queued = useRef(false);
  const dragging = useRef(false);
  const firstRender = useRef(true);
  // Bumped on every edit so we know whether the last save covered everything.
  const version = useRef(0);

  const flush = useCallback(async () => {
    if (saving.current) {
      // A save is in flight; it will run again with the latest state when done.
      queued.current = true;
      return;
    }
    saving.current = true;
    setStatus("saving");
    let result: SaveResult = {};
    let savedVersion = version.current;
    do {
      queued.current = false;
      savedVersion = version.current;
      try {
        result = await save(programId, toPayload(latestWeeks.current));
      } catch {
        result = { error: "Network error. Your changes are not saved yet." };
      }
    } while (queued.current && !result.error);
    saving.current = false;

    if (result.error) {
      setStatus("error");
      setSaveError(result.error);
    } else {
      setSaveError(null);
      setStatus(savedVersion === version.current ? "saved" : "dirty");
    }
  }, [programId, save]);

  useEffect(() => {
    latestWeeks.current = weeks;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    version.current += 1;
    setStatus((s) => (s === "saving" ? s : "dirty"));
    if (dragging.current) return; // save once the drag finishes
    const t = setTimeout(() => void flush(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [weeks, flush]);

  useEffect(() => {
    if (status === "saved") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void flush();
      }
      if (e.key === "Escape") dispatch({ type: "clearSelection" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flush]);

  // ---------------------------------------------------------------- drag & drop
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [active, setActive] = useState<
    { kind: "library"; exercise?: LibraryExercise } | { kind: "item"; item: BuilderItem } | null
  >(null);
  const snapshot = useRef<BuilderWeek[] | null>(null);

  /** Where a drop over `over` lands: [dayId, index]. */
  const resolveTarget = (event: DragOverEvent | DragEndEvent): [string, number] | null => {
    const { over, active: act } = event;
    if (!over) return null;
    const data = over.data.current as DragData | { type: "day"; dayId: string } | undefined;
    if (!data) return null;
    if (data.type === "day") {
      const day = week.days.find((d) => d.id === data.dayId);
      return day ? [day.id, day.items.length] : null;
    }
    if (data.type === "item") {
      const loc = findItem(weeks, String(over.id));
      if (!loc) return null;
      const day = weeks[loc.weekIndex].days[loc.dayIndex];
      const translated = act.rect.current.translated;
      const below = translated && translated.top > over.rect.top + over.rect.height / 2;
      return [day.id, loc.itemIndex + (below ? 1 : 0)];
    }
    return null;
  };

  const onDragStart = ({ active: act }: DragStartEvent) => {
    dragging.current = true;
    snapshot.current = weeks;
    const data = act.data.current as DragData;
    if (data.type === "library") {
      setActive({ kind: "library", exercise: exercisesById.get(data.exerciseId) });
    } else {
      const loc = findItem(weeks, String(act.id));
      if (loc) {
        setActive({
          kind: "item",
          item: weeks[loc.weekIndex].days[loc.dayIndex].items[loc.itemIndex],
        });
      }
    }
  };

  // Move items between days live so the target column opens a gap.
  const onDragOver = (event: DragOverEvent) => {
    const data = event.active.data.current as DragData;
    if (data.type !== "item" || !event.over) return;
    const from = findItem(weeks, String(event.active.id));
    const target = resolveTarget(event);
    if (!from || !target) return;
    const fromDayId = weeks[from.weekIndex].days[from.dayIndex].id;
    if (fromDayId === target[0]) return; // same-day reordering is handled by SortableContext
    dispatch({
      type: "moveRaw",
      itemId: String(event.active.id),
      toDayId: target[0],
      toIndex: target[1],
    });
  };

  const endDrag = () => {
    dragging.current = false;
    snapshot.current = null;
    setActive(null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const data = event.active.data.current as DragData;
    const actions: BuilderAction[] = [];

    if (data.type === "library") {
      const target = resolveTarget(event);
      if (target) {
        actions.push({
          type: "addExercise",
          dayId: target[0],
          exerciseId: data.exerciseId,
          index: target[1],
        });
        setTargetDayId(target[0]);
      }
    } else if (event.over) {
      const itemId = String(event.active.id);
      const from = findItem(weeks, itemId);
      const overData = event.over.data.current as { type: string; dayId: string } | undefined;
      if (from && overData) {
        const dayId = weeks[from.weekIndex].days[from.dayIndex].id;
        let toIndex = from.itemIndex;
        if (overData.type === "item" && String(event.over.id) !== itemId) {
          const overLoc = findItem(weeks, String(event.over.id));
          if (overLoc) toIndex = overLoc.itemIndex;
        } else if (overData.type === "day" && overData.dayId === dayId) {
          toIndex = weeks[from.weekIndex].days[from.dayIndex].items.length - 1;
        }
        // `drop` removes then re-inserts, so the over-item's index is the final slot.
        actions.push({ type: "drop", itemId, toDayId: dayId, toIndex });
      }
    } else if (snapshot.current) {
      actions.push({ type: "replaceWeeks", weeks: snapshot.current });
    }

    endDrag();
    actions.forEach(dispatch);
  };

  const onDragCancel = () => {
    if (snapshot.current) dispatch({ type: "replaceWeeks", weeks: snapshot.current });
    endDrag();
  };

  // ---------------------------------------------------------------- layout
  const [libraryOpen, setLibraryOpen] = useState(false);
  const selectionDay = selection.length
    ? week?.days.find((d) => d.items.some((i) => i.id === selection[0]))
    : undefined;

  if (!week) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="flex h-[calc(100dvh-7rem)] min-h-[32rem] flex-col gap-3 md:h-[calc(100dvh-4rem)]">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <Link
              href={`/programs/${programId}`}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
            >
              ← Program details
            </Link>
            <h1 className="truncate text-xl font-semibold tracking-tight">{programName}</h1>
          </div>
          <SaveIndicator status={status} error={saveError} onRetry={() => void flush()} />
        </div>

        {/* Week tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Weeks" className="flex max-w-full gap-1 overflow-x-auto">
            {weeks.map((w, i) => (
              <button
                key={w.id}
                role="tab"
                type="button"
                aria-selected={i === activeWeek}
                onClick={() => dispatch({ type: "setActiveWeek", index: i })}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium",
                  i === activeWeek
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50",
                )}
              >
                Week {i + 1}
                {w.label ? <span className="ml-1 font-normal opacity-70">· {w.label}</span> : null}
              </button>
            ))}
            <button
              type="button"
              onClick={() => dispatch({ type: "addWeek" })}
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              + Week
            </button>
          </div>
          <div className="ml-auto flex items-center gap-1 text-sm">
            <input
              value={week.label}
              onChange={(e) =>
                dispatch({
                  type: "updateWeek",
                  index: activeWeek,
                  patch: { label: e.target.value },
                })
              }
              placeholder="Week label (e.g. Deload)"
              aria-label="Week label"
              className="h-8 w-44 rounded-md border-0 bg-white px-2 text-sm ring-1 ring-inset ring-zinc-200"
            />
            <button
              type="button"
              onClick={() => dispatch({ type: "duplicateWeek", index: activeWeek })}
              className="rounded-md px-2 py-1.5 font-medium text-zinc-600 hover:bg-zinc-100"
            >
              Duplicate week
            </button>
            {weeks.length > 1 ? (
              <button
                type="button"
                onClick={() => {
                  const hasWork = week.days.some((d) => d.items.length > 0);
                  if (!hasWork || confirm(`Delete week ${activeWeek + 1}?`)) {
                    dispatch({ type: "removeWeek", index: activeWeek });
                  }
                }}
                className="rounded-md px-2 py-1.5 font-medium text-zinc-500 hover:bg-red-50 hover:text-red-600"
              >
                Delete
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 gap-4">
          {/* Library (desktop) */}
          <aside className="hidden w-72 shrink-0 lg:block">
            <LibraryPanel exercises={library} onAdd={addToTarget} targetDayName={targetDay?.name} />
          </aside>

          {/* Days */}
          <div className="min-w-0 flex-1 overflow-auto pb-24 lg:pb-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]">
              {week.days.map((day) => (
                <DayColumn
                  key={day.id}
                  day={day}
                  exercisesById={exercisesById}
                  selection={selectionDay?.id === day.id ? selection : EMPTY}
                  isTarget={day.id === targetDay?.id}
                  canRemove={week.days.length > 1}
                  onFocus={focusDay}
                  dispatch={dispatch}
                />
              ))}
              <button
                type="button"
                onClick={() => dispatch({ type: "addDay", weekIndex: activeWeek })}
                className="min-h-24 rounded-xl border-2 border-dashed border-zinc-300 text-sm font-medium text-zinc-500 hover:border-brand-500 hover:text-brand-700"
              >
                + Add day
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grouping toolbar */}
      {selection.length > 0 ? (
        <div className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-xl flex-wrap items-center gap-2 rounded-xl bg-zinc-900 p-2 pl-4 text-sm text-white shadow-lg">
          <span className="mr-auto">
            {selection.length} selected
            {selection.length < 2 ? " · pick one more to group" : ""}
          </span>
          {EXERCISE_GROUP_TYPES.map((g) => (
            <button
              key={g}
              type="button"
              disabled={selection.length < 2}
              onClick={() => dispatch({ type: "groupSelected", groupType: g })}
              className="rounded-md bg-white/10 px-2.5 py-1.5 font-medium hover:bg-white/20 disabled:opacity-40"
            >
              {GROUP_LABELS[g]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => dispatch({ type: "clearSelection" })}
            className="rounded-md px-2 py-1.5 text-zinc-300 hover:text-white"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {/* Library (mobile / tablet) */}
      <button
        type="button"
        onClick={() => setLibraryOpen(true)}
        className={cn(
          "fixed right-4 bottom-4 z-20 rounded-full bg-brand-700 px-5 py-3 text-sm font-semibold text-white shadow-lg lg:hidden",
          selection.length > 0 && "hidden",
        )}
      >
        + Add exercise
      </button>
      {libraryOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-label="Exercise library">
          <button
            type="button"
            aria-label="Close library"
            className="absolute inset-0 bg-black/30"
            onClick={() => setLibraryOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 flex h-[75dvh] flex-col rounded-t-2xl bg-zinc-50 p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Add to {targetDay?.name || "day"}</h2>
              <button
                type="button"
                onClick={() => setLibraryOpen(false)}
                className="text-sm font-semibold text-brand-700"
              >
                Done
              </button>
            </div>
            <LibraryPanel exercises={library} onAdd={addToTarget} targetDayName={targetDay?.name} />
          </div>
        </div>
      ) : null}

      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="flex w-64 cursor-grabbing items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-lg ring-2 ring-brand-500">
            {active.kind === "library" ? (
              <ExerciseCardBody exercise={active.exercise} />
            ) : (
              <ExerciseCardBody
                exercise={exercisesById.get(active.item.exerciseId)}
                item={active.item}
              />
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

const EMPTY: string[] = [];

function SaveIndicator({
  status,
  error,
  onRetry,
}: {
  status: SaveStatus;
  error: string | null;
  onRetry: () => void;
}) {
  if (status === "error") {
    return (
      <div role="alert" className="flex items-center gap-2 text-sm text-red-700">
        <span className="max-w-xs truncate">Not saved: {error}</span>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-red-50 px-2 py-1 font-semibold hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }
  const text = { saved: "All changes saved", dirty: "Unsaved changes", saving: "Saving…" }[status];
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-zinc-500">
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          status === "saved"
            ? "bg-brand-500"
            : status === "saving"
              ? "bg-amber-400"
              : "bg-zinc-400",
        )}
      />
      {text}
    </p>
  );
}
