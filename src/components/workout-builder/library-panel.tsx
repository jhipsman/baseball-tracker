"use client";

import { memo, useDeferredValue, useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import {
  CATEGORY_DOT,
  CATEGORY_LABELS,
  EQUIPMENT,
  EXERCISE_CATEGORIES,
  humanize,
  type ExerciseCategory,
} from "@/constants";
import { cn } from "@/lib/utils";
import type { LibraryExercise } from "./types";

export const LIBRARY_PREFIX = "lib:";

const LibraryCard = memo(function LibraryCard({
  exercise,
  onAdd,
}: {
  exercise: LibraryExercise;
  onAdd: (exerciseId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: LIBRARY_PREFIX + exercise.id,
    data: { type: "library", exerciseId: exercise.id },
    // The card holds its own "+" button, so it must not itself be a button.
    attributes: { role: "listitem", roleDescription: "draggable exercise" },
  });

  return (
    <li
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "group flex cursor-grab touch-manipulation items-center gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-zinc-200 select-none hover:ring-brand-500 active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <span
        aria-hidden
        className={cn("size-2 shrink-0 rounded-full", CATEGORY_DOT[exercise.category])}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{exercise.name}</span>
        <span className="block truncate text-xs text-zinc-500">
          {CATEGORY_LABELS[exercise.category]}
          {exercise.is_custom ? " · Custom" : ""}
        </span>
      </span>
      <button
        type="button"
        // Keep the button clickable without starting a drag.
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onClick={() => onAdd(exercise.id)}
        aria-label={`Add ${exercise.name} to the selected day`}
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-lg leading-none text-zinc-500 hover:bg-brand-50 hover:text-brand-700"
      >
        +
      </button>
    </li>
  );
});

export function LibraryPanel({
  exercises,
  onAdd,
  targetDayName,
}: {
  exercises: LibraryExercise[];
  onAdd: (exerciseId: string) => void;
  targetDayName?: string;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [equipment, setEquipment] = useState("");
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const terms = deferredQuery.toLowerCase().split(/\s+/).filter(Boolean);
    return exercises.filter((ex) => {
      if (category && ex.category !== category) return false;
      if (equipment && !ex.equipment.includes(equipment)) return false;
      if (terms.length === 0) return true;
      const haystack = [ex.name, ex.category, ...ex.muscle_groups, ...ex.equipment]
        .join(" ")
        .toLowerCase()
        .replace(/_/g, " ");
      return terms.every((t) => haystack.includes(t));
    });
  }, [exercises, deferredQuery, category, equipment]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="space-y-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, muscle, equipment…"
          aria-label="Search exercises"
          className="block h-10 w-full rounded-lg border-0 bg-white px-3 text-base ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-600 sm:text-sm"
        />
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
              category === null
                ? "bg-brand-700 text-white ring-brand-700"
                : "bg-white text-zinc-700 ring-zinc-300",
            )}
          >
            All
          </button>
          {EXERCISE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(category === c ? null : c)}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                category === c
                  ? "bg-brand-700 text-white ring-brand-700"
                  : "bg-white text-zinc-700 ring-zinc-300",
              )}
            >
              <span aria-hidden className={cn("size-1.5 rounded-full", CATEGORY_DOT[c])} />
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <select
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
          aria-label="Filter by equipment"
          className="block h-9 w-full rounded-lg border-0 bg-white px-2 text-sm ring-1 ring-inset ring-zinc-300"
        >
          <option value="">Any equipment</option>
          {EQUIPMENT.map((e) => (
            <option key={e} value={e}>
              {humanize(e)}
            </option>
          ))}
        </select>
        <p className="text-xs text-zinc-500">
          {filtered.length} exercise{filtered.length === 1 ? "" : "s"} · drag into a day
          {targetDayName ? (
            <>
              {" "}
              or tap + to add to <strong className="text-zinc-700">{targetDayName}</strong>
            </>
          ) : null}
        </p>
      </div>
      <ul className="-mx-1 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-1 pb-2">
        {filtered.map((ex) => (
          <LibraryCard key={ex.id} exercise={ex} onAdd={onAdd} />
        ))}
        {filtered.length === 0 ? (
          <li className="py-6 text-center text-sm text-zinc-500">No matches.</li>
        ) : null}
      </ul>
    </div>
  );
}
