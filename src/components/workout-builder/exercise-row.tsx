"use client";

import { memo, useState, type Dispatch } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CATEGORY_DOT, GROUP_LABELS } from "@/constants";
import { cn } from "@/lib/utils";
import { summarize } from "./format";
import type { BuilderAction } from "./reducer";
import type { BuilderItem, LibraryExercise } from "./types";

const GROUP_BAR: Record<string, string> = {
  superset: "border-l-sky-500",
  circuit: "border-l-violet-500",
  emom: "border-l-amber-500",
  amrap: "border-l-rose-500",
};

const inputClass =
  "block h-9 w-full rounded-md border-0 bg-white px-2 text-base ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-brand-600 sm:text-sm";

function toInt(value: string): number | null {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Static card used for the drag overlay and as the row body. */
export function ExerciseCardBody({
  label,
  exercise,
  item,
}: {
  label?: string;
  exercise?: LibraryExercise;
  item?: BuilderItem;
}) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      {label ? (
        <span className="w-7 shrink-0 text-xs font-semibold text-zinc-400 tabular-nums">
          {label}
        </span>
      ) : null}
      {exercise ? (
        <span
          aria-hidden
          className={cn("size-2 shrink-0 rounded-full", CATEGORY_DOT[exercise.category])}
        />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm leading-snug font-medium">
          {exercise?.name ?? "Unknown exercise"}
        </span>
        {item ? (
          <span className="block truncate text-xs text-zinc-500">
            {summarize(item) || "Tap to set sets & reps"}
          </span>
        ) : null}
      </span>
    </span>
  );
}

type Props = {
  item: BuilderItem;
  dayId: string;
  label: string;
  exercise?: LibraryExercise;
  selected: boolean;
  groupStart: boolean;
  dispatch: Dispatch<BuilderAction>;
};

export const ExerciseRow = memo(function ExerciseRow({
  item,
  dayId,
  label,
  exercise,
  selected,
  groupStart,
  dispatch,
}: Props) {
  const [open, setOpen] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, data: { type: "item", dayId } });

  const update = (patch: Partial<Omit<BuilderItem, "id">>) =>
    dispatch({ type: "updateItem", itemId: item.id, patch });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative rounded-lg bg-white",
        selected ? "ring-2 ring-brand-600" : "ring-1 ring-zinc-200",
        item.groupId && "border-l-4",
        item.groupType && GROUP_BAR[item.groupType],
        isDragging && "z-10 opacity-40",
      )}
    >
      {groupStart && item.groupType ? (
        <div className="flex items-center justify-between px-2 pt-1.5 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
          {GROUP_LABELS[item.groupType]}
          <button
            type="button"
            onClick={() => dispatch({ type: "ungroup", dayId, groupId: item.groupId! })}
            className="font-medium tracking-normal text-zinc-400 normal-case hover:text-zinc-700"
          >
            Ungroup
          </button>
        </div>
      ) : null}
      <div className="flex items-center gap-1 py-1.5 pr-1 pl-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          aria-label={`Drag ${exercise?.name ?? "exercise"}`}
          className="flex h-9 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 active:cursor-grabbing"
        >
          <svg viewBox="0 0 8 14" className="h-3.5 w-2" fill="currentColor" aria-hidden>
            <circle cx="2" cy="2" r="1.2" />
            <circle cx="6" cy="2" r="1.2" />
            <circle cx="2" cy="7" r="1.2" />
            <circle cx="6" cy="7" r="1.2" />
            <circle cx="2" cy="12" r="1.2" />
            <circle cx="6" cy="12" r="1.2" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 rounded py-0.5 text-left"
        >
          <ExerciseCardBody label={label} exercise={exercise} item={item} />
        </button>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => dispatch({ type: "toggleSelect", itemId: item.id })}
          aria-label={`Select ${exercise?.name ?? "exercise"} for grouping`}
          className="size-4 shrink-0 accent-brand-700"
        />
        <button
          type="button"
          onClick={() => dispatch({ type: "removeItem", itemId: item.id })}
          aria-label={`Remove ${exercise?.name ?? "exercise"}`}
          className="flex size-8 shrink-0 items-center justify-center rounded text-zinc-400 hover:bg-red-50 hover:text-red-600"
        >
          ×
        </button>
      </div>

      {open ? (
        <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 p-2 sm:grid-cols-3">
          <label className="text-xs text-zinc-600">
            Sets
            <input
              className={inputClass}
              inputMode="numeric"
              value={item.sets ?? ""}
              onChange={(e) => update({ sets: toInt(e.target.value) })}
            />
          </label>
          <label className="text-xs text-zinc-600">
            Reps
            <input
              className={inputClass}
              value={item.reps}
              placeholder="8, 8-10, 30s"
              maxLength={32}
              onChange={(e) => update({ reps: e.target.value })}
            />
          </label>
          <label className="text-xs text-zinc-600">
            Intensity
            <input
              className={inputClass}
              value={item.intensity}
              placeholder="75%, RPE 7"
              maxLength={32}
              onChange={(e) => update({ intensity: e.target.value })}
            />
          </label>
          <label className="text-xs text-zinc-600">
            Tempo
            <input
              className={inputClass}
              value={item.tempo}
              placeholder="3-1-1-0"
              maxLength={16}
              onChange={(e) => update({ tempo: e.target.value })}
            />
          </label>
          <label className="text-xs text-zinc-600">
            Rest (sec)
            <input
              className={inputClass}
              inputMode="numeric"
              value={item.restSeconds ?? ""}
              placeholder="90"
              onChange={(e) => {
                const v = toInt(e.target.value);
                update({ restSeconds: v == null ? null : Math.min(v, 3600) });
              }}
            />
          </label>
          <label className="col-span-2 text-xs text-zinc-600 sm:col-span-3">
            Notes / cues
            <textarea
              className={cn(inputClass, "h-auto py-1.5")}
              rows={2}
              value={item.notes}
              onChange={(e) => update({ notes: e.target.value })}
            />
          </label>
        </div>
      ) : null}
    </li>
  );
});
