"use client";

import { memo, useMemo, type Dispatch } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DAY_OF_WEEK_LABELS, SESSION_LABELS, SESSION_TYPES } from "@/constants";
import { cn } from "@/lib/utils";
import { ExerciseRow } from "./exercise-row";
import { blockLabels, type BuilderAction } from "./reducer";
import type { BuilderDay, LibraryExercise } from "./types";

export const DAY_PREFIX = "day:";

type Props = {
  day: BuilderDay;
  exercisesById: Map<string, LibraryExercise>;
  selection: string[];
  isTarget: boolean;
  canRemove: boolean;
  onFocus: (dayId: string) => void;
  dispatch: Dispatch<BuilderAction>;
};

export const DayColumn = memo(function DayColumn({
  day,
  exercisesById,
  selection,
  isTarget,
  canRemove,
  onFocus,
  dispatch,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: DAY_PREFIX + day.id,
    data: { type: "day", dayId: day.id },
  });
  const itemIds = useMemo(() => day.items.map((i) => i.id), [day.items]);
  const labels = useMemo(() => blockLabels(day.items), [day.items]);
  const selected = useMemo(() => new Set(selection), [selection]);
  const update = (patch: Partial<Pick<BuilderDay, "name" | "sessionType" | "dayOfWeek">>) =>
    dispatch({ type: "updateDay", dayId: day.id, patch });

  return (
    <section
      onFocusCapture={() => onFocus(day.id)}
      onPointerDown={() => onFocus(day.id)}
      aria-label={day.name || "Day"}
      className={cn(
        "flex min-h-48 flex-col rounded-xl bg-zinc-100/80 p-2 ring-1 ring-inset",
        isTarget ? "ring-brand-500" : "ring-zinc-200",
      )}
    >
      <header className="mb-2 space-y-1.5 px-1">
        <div className="flex items-center gap-1">
          <input
            value={day.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Day name"
            aria-label="Day name"
            className="min-w-0 flex-1 rounded-md border-0 bg-transparent px-1 py-1 text-sm font-semibold hover:bg-white focus:bg-white focus:ring-2 focus:ring-brand-600"
          />
          <button
            type="button"
            onClick={() => dispatch({ type: "duplicateDay", dayId: day.id })}
            title="Duplicate day"
            className="rounded px-1.5 py-1 text-xs text-zinc-500 hover:bg-white hover:text-zinc-800"
          >
            Copy
          </button>
          {canRemove ? (
            <button
              type="button"
              onClick={() => {
                if (day.items.length === 0 || confirm(`Delete ${day.name || "this day"}?`)) {
                  dispatch({ type: "removeDay", dayId: day.id });
                }
              }}
              title="Delete day"
              aria-label={`Delete ${day.name || "day"}`}
              className="rounded px-1.5 py-1 text-sm text-zinc-400 hover:bg-white hover:text-red-600"
            >
              ×
            </button>
          ) : null}
        </div>
        <div className="flex gap-1">
          <select
            value={day.sessionType}
            onChange={(e) => update({ sessionType: e.target.value as BuilderDay["sessionType"] })}
            aria-label="Session type"
            className="h-8 min-w-0 flex-1 rounded-md border-0 bg-white px-1.5 text-xs ring-1 ring-inset ring-zinc-200"
          >
            {SESSION_TYPES.map((t) => (
              <option key={t} value={t}>
                {SESSION_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            value={day.dayOfWeek ?? ""}
            onChange={(e) =>
              update({ dayOfWeek: e.target.value === "" ? null : Number(e.target.value) })
            }
            aria-label="Day of week"
            className="h-8 w-20 rounded-md border-0 bg-white px-1.5 text-xs ring-1 ring-inset ring-zinc-200"
          >
            <option value="">Any day</option>
            {DAY_OF_WEEK_LABELS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </header>

      <SortableContext id={day.id} items={itemIds} strategy={verticalListSortingStrategy}>
        <ul
          ref={setNodeRef}
          className={cn(
            "flex min-h-24 flex-1 flex-col gap-1.5 rounded-lg p-0.5 transition-colors",
            isOver && "bg-brand-50",
          )}
        >
          {day.items.map((item, i) => (
            <ExerciseRow
              key={item.id}
              item={item}
              dayId={day.id}
              label={labels[i]}
              exercise={exercisesById.get(item.exerciseId)}
              selected={selected.has(item.id)}
              groupStart={!!item.groupId && day.items[i - 1]?.groupId !== item.groupId}
              dispatch={dispatch}
            />
          ))}
          {day.items.length === 0 ? (
            <li className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500">
              Drag exercises here
            </li>
          ) : null}
        </ul>
      </SortableContext>
    </section>
  );
});
