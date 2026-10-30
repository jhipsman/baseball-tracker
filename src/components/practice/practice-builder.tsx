"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { savePracticeBlocks } from "@/lib/practice-actions";
import {
  blockTimes,
  formatDuration,
  formatTime12,
  KIND_INFO,
  MAX_BLOCKS,
  MAX_STATIONS,
  parseTime,
  PRACTICE_KINDS,
  totalMinutes,
  type PracticeBlock,
  type PracticeKind,
  type Station,
} from "@/lib/practices";
import { cn } from "@/lib/utils";

type Status = "saved" | "dirty" | "saving" | "error";
const AUTOSAVE_MS = 800;

const DEFAULT_MIN: Partial<Record<PracticeKind, number>> = {
  warmup: 15,
  throwing: 15,
  hitting: 30,
  defense: 20,
  conditioning: 10,
};

const newId = () => crypto.randomUUID();
const strip = (blocks: PracticeBlock[]) =>
  blocks.map((b) => ({
    kind: b.kind,
    title: b.title,
    durationMin: b.durationMin,
    details: b.details,
    stations: b.stations,
  }));

const inputClass =
  "block w-full rounded-lg border-0 bg-surface px-2.5 text-base text-zinc-900 ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm";

export function PracticeBuilder({
  planId,
  startTime,
  initialBlocks,
}: {
  planId: string;
  startTime: string | null;
  initialBlocks: PracticeBlock[];
}) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [focusId, setFocusId] = useState<string | null>(null);

  // ------------------------------------------------------------ autosave
  const [status, setStatus] = useState<Status>("saved");
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(blocks);
  const version = useRef(0);
  const saving = useRef(false);
  const queued = useRef(false);
  const first = useRef(true);

  const flush = useCallback(async () => {
    if (saving.current) {
      queued.current = true;
      return;
    }
    saving.current = true;
    setStatus("saving");
    let result: { error?: string } = {};
    let saved = version.current;
    do {
      queued.current = false;
      saved = version.current;
      try {
        result = await savePracticeBlocks(planId, strip(latest.current));
      } catch {
        result = { error: "Network error. Your changes are not saved yet." };
      }
    } while (queued.current && !result.error);
    saving.current = false;
    if (result.error) {
      setStatus("error");
      setError(result.error);
    } else {
      setError(null);
      setStatus(saved === version.current ? "saved" : "dirty");
    }
  }, [planId]);

  useEffect(() => {
    latest.current = blocks;
    if (first.current) {
      first.current = false;
      return;
    }
    version.current += 1;
    setStatus((s) => (s === "saving" ? s : "dirty"));
    // Don't autosave a block that's still missing its title; save once it has one.
    if (blocks.some((b) => !b.title.trim())) return;
    const t = setTimeout(() => void flush(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [blocks, flush]);

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
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flush]);

  // ------------------------------------------------------------ edits
  const update = useCallback((id: string, patch: Partial<PracticeBlock>) => {
    setBlocks((cur) => cur.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, []);
  const move = useCallback((id: string, delta: number) => {
    setBlocks((cur) => {
      const i = cur.findIndex((b) => b.id === id);
      const j = i + delta;
      return i < 0 || j < 0 || j >= cur.length ? cur : arrayMove(cur, i, j);
    });
  }, []);
  const remove = useCallback((id: string) => {
    setBlocks((cur) => cur.filter((b) => b.id !== id));
  }, []);
  const duplicate = useCallback((id: string) => {
    setBlocks((cur) => {
      const i = cur.findIndex((b) => b.id === id);
      if (i < 0 || cur.length >= MAX_BLOCKS) return cur;
      const copy = { ...cur[i], id: newId(), stations: cur[i].stations.map((s) => ({ ...s })) };
      return [...cur.slice(0, i + 1), copy, ...cur.slice(i + 1)];
    });
  }, []);
  const toggle = useCallback((id: string) => {
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const add = (kind: PracticeKind) => {
    if (blocks.length >= MAX_BLOCKS) return;
    const id = newId();
    setBlocks((cur) => [
      ...cur,
      {
        id,
        kind,
        title: KIND_INFO[kind].label,
        durationMin: DEFAULT_MIN[kind] ?? 15,
        details: "",
        stations: [],
      },
    ]);
    setFocusId(id);
  };

  // ------------------------------------------------------------ drag & drop
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setBlocks((cur) => {
      const from = cur.findIndex((b) => b.id === active.id);
      const to = cur.findIndex((b) => b.id === over.id);
      return from < 0 || to < 0 ? cur : arrayMove(cur, from, to);
    });
  };

  const times = blockTimes(startTime, blocks);
  const total = totalMinutes(blocks);
  const start = parseTime(startTime);

  return (
    <section aria-label="Practice blocks" className="space-y-3">
      <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface/95 px-3 py-2 ring-1 ring-zinc-200 backdrop-blur">
        <p className="text-sm">
          <span className="font-semibold tabular-nums" data-testid="practice-total">
            {formatDuration(total)}
          </span>
          {start != null ? (
            <span className="text-zinc-600 tabular-nums" data-testid="practice-end">
              {" "}
              · {formatTime12(start)} – {formatTime12(start + total)}
            </span>
          ) : (
            <span className="text-zinc-500"> · set a start time to see the clock</span>
          )}
          <span className="text-zinc-500">
            {" "}
            · {blocks.length} block{blocks.length === 1 ? "" : "s"}
          </span>
        </p>
        <div className="flex items-center gap-2">
          <span
            role="status"
            data-testid="save-status"
            className={cn(
              "text-xs font-medium",
              status === "error" ? "text-red-700" : "text-zinc-500",
            )}
          >
            {status === "saved"
              ? "All changes saved"
              : status === "saving"
                ? "Saving…"
                : status === "error"
                  ? "Not saved"
                  : blocks.some((b) => !b.title.trim())
                    ? "Add a title to save"
                    : "Unsaved changes"}
          </span>
          <button
            type="button"
            onClick={() => void flush()}
            disabled={status === "saved" || status === "saving"}
            className="h-8 rounded-lg bg-brand-700 px-3 text-xs font-semibold text-on-brand hover:bg-brand-600 disabled:bg-zinc-200 disabled:text-zinc-500"
          >
            Save
          </button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {blocks.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
          No blocks yet. Add a warm-up to start building the practice.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-2">
              {blocks.map((b, i) => (
                <BlockCard
                  key={b.id}
                  block={b}
                  index={i}
                  count={blocks.length}
                  time={times[i].label}
                  open={open.has(b.id)}
                  autoFocus={focusId === b.id}
                  onUpdate={update}
                  onMove={move}
                  onRemove={remove}
                  onDuplicate={duplicate}
                  onToggle={toggle}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <div className="rounded-xl bg-zinc-100 p-3">
        <p className="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Add block
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PRACTICE_KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => add(k.key)}
              disabled={blocks.length >= MAX_BLOCKS}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-3 text-sm font-medium ring-1 ring-zinc-300 ring-inset hover:bg-zinc-50 disabled:opacity-50"
            >
              <span aria-hidden className={cn("size-2.5 rounded-full", k.dot)} />+ {k.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

type CardProps = {
  block: PracticeBlock;
  index: number;
  count: number;
  time: string;
  open: boolean;
  autoFocus: boolean;
  onUpdate: (id: string, patch: Partial<PracticeBlock>) => void;
  onMove: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggle: (id: string) => void;
};

const BlockCard = memo(function BlockCard({
  block: b,
  index,
  count,
  time,
  open,
  autoFocus,
  onUpdate,
  onMove,
  onRemove,
  onDuplicate,
  onToggle,
}: CardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: b.id });
  const kind = KIND_INFO[b.kind];
  const set = (patch: Partial<PracticeBlock>) => onUpdate(b.id, patch);
  const setStation = (i: number, patch: Partial<Station>) =>
    set({ stations: b.stations.map((s, si) => (si === i ? { ...s, ...patch } : s)) });
  const extras = [
    b.details ? "notes" : null,
    b.stations.length ? `${b.stations.length} station${b.stations.length === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      data-testid="practice-block"
      className={cn(
        "rounded-xl bg-surface ring-1 ring-zinc-200",
        isDragging && "relative z-10 shadow-lg ring-brand-500",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 p-2 sm:flex-nowrap">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          aria-label={`Reorder ${b.title || "block"}`}
          className="flex h-9 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 active:cursor-grabbing"
        >
          <svg viewBox="0 0 10 16" className="h-4 w-2.5" fill="currentColor" aria-hidden>
            {[2, 8, 14].flatMap((y) => [
              <circle key={`a${y}`} cx="2" cy={y} r="1.5" />,
              <circle key={`b${y}`} cx="8" cy={y} r="1.5" />,
            ])}
          </svg>
        </button>
        <span
          className="w-[4.75rem] shrink-0 text-xs font-semibold text-zinc-700 tabular-nums"
          data-testid="block-time"
        >
          {time}
        </span>
        {/* Phone: times & minutes on the first row, kind + title on the second. */}
        <span aria-hidden className="order-1 h-0 basis-full sm:hidden" />
        <label className="relative order-2 flex shrink-0 items-center sm:order-none">
          <span className="sr-only">Kind</span>
          <span
            aria-hidden
            className={cn("pointer-events-none absolute left-2.5 size-2.5 rounded-full", kind.dot)}
          />
          <select
            value={b.kind}
            onChange={(e) => set({ kind: e.target.value as PracticeKind })}
            className="h-9 rounded-lg border-0 bg-zinc-50 pr-7 pl-7 text-sm ring-1 ring-zinc-200 ring-inset focus:ring-2 focus:ring-brand-600"
          >
            {PRACTICE_KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <input
          value={b.title}
          onChange={(e) => set({ title: e.target.value.slice(0, 120) })}
          placeholder="Block title"
          aria-label="Block title"
          autoFocus={autoFocus}
          onFocus={(e) => autoFocus && e.currentTarget.select()}
          className={cn(
            inputClass,
            "order-3 h-9 min-w-0 flex-1 font-medium sm:order-none",
            !b.title.trim() && "ring-red-300",
          )}
        />
        <div className="ml-auto flex shrink-0 items-center sm:ml-0">
          <button
            type="button"
            aria-label="5 minutes less"
            onClick={() => set({ durationMin: Math.max(1, b.durationMin - 5) })}
            className="flex h-9 w-8 items-center justify-center rounded-l-lg bg-zinc-50 text-lg text-zinc-600 ring-1 ring-zinc-200 ring-inset hover:bg-zinc-100"
          >
            −
          </button>
          <MinutesInput value={b.durationMin} onChange={(n) => set({ durationMin: n })} />
          <button
            type="button"
            aria-label="5 minutes more"
            onClick={() => set({ durationMin: Math.min(240, b.durationMin + 5) })}
            className="flex h-9 w-8 items-center justify-center rounded-r-lg bg-zinc-50 text-lg text-zinc-600 ring-1 ring-zinc-200 ring-inset hover:bg-zinc-100"
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={() => onToggle(b.id)}
          aria-expanded={open}
          className={cn(
            "h-9 shrink-0 rounded-lg px-2 text-xs font-medium ring-1 ring-inset",
            open
              ? "bg-brand-50 text-brand-900 ring-brand-200"
              : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50",
          )}
        >
          {open ? "Done" : "Details"}
          {!open && extras.length ? (
            <span className="text-zinc-500">
              <span className="sm:hidden"> ({extras.length})</span>
              <span className="hidden sm:inline"> · {extras.join(", ")}</span>
            </span>
          ) : null}
        </button>
      </div>

      {open ? (
        <div className="space-y-3 border-t border-zinc-100 p-3">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-600">Details / coaching points</span>
            <textarea
              value={b.details}
              onChange={(e) => set({ details: e.target.value.slice(0, 2000) })}
              rows={2}
              placeholder="Drills, reps, what to emphasize…"
              className={cn(inputClass, "py-2")}
            />
          </label>

          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-600">
              Stations <span className="font-normal text-zinc-400">(run at the same time)</span>
            </p>
            {b.stations.map((s, si) => (
              <div
                key={si}
                className="grid grid-cols-[1fr_auto] gap-1.5 rounded-lg bg-zinc-50 p-2 sm:grid-cols-[1fr_9rem_1.5fr_auto]"
              >
                <input
                  value={s.name}
                  onChange={(e) => setStation(si, { name: e.target.value.slice(0, 80) })}
                  placeholder="Station (e.g. Cage 1)"
                  aria-label={`Station ${si + 1} name`}
                  className={cn(inputClass, "h-9")}
                />
                <button
                  type="button"
                  aria-label={`Remove station ${si + 1}`}
                  onClick={() => set({ stations: b.stations.filter((_, x) => x !== si) })}
                  className="row-span-1 h-9 rounded-lg px-2 text-zinc-400 hover:bg-surface hover:text-red-600 sm:order-last"
                >
                  ✕
                </button>
                <input
                  value={s.coach ?? ""}
                  onChange={(e) => setStation(si, { coach: e.target.value.slice(0, 80) })}
                  placeholder="Coach"
                  aria-label={`Station ${si + 1} coach`}
                  className={cn(inputClass, "col-span-2 h-9 sm:col-span-1")}
                />
                <input
                  value={s.detail ?? ""}
                  onChange={(e) => setStation(si, { detail: e.target.value.slice(0, 300) })}
                  placeholder="What they're doing"
                  aria-label={`Station ${si + 1} detail`}
                  className={cn(inputClass, "col-span-2 h-9 sm:col-span-1")}
                />
              </div>
            ))}
            {b.stations.length < MAX_STATIONS ? (
              <button
                type="button"
                onClick={() => set({ stations: [...b.stations, { name: "" }] })}
                className="h-9 rounded-lg px-3 text-sm font-medium text-brand-700 ring-1 ring-brand-200 ring-inset hover:bg-brand-50"
              >
                + Add station
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-1.5 border-t border-zinc-100 pt-3">
            <SmallButton onClick={() => onMove(b.id, -1)} disabled={index === 0}>
              ↑ Move up
            </SmallButton>
            <SmallButton onClick={() => onMove(b.id, 1)} disabled={index === count - 1}>
              ↓ Move down
            </SmallButton>
            <SmallButton onClick={() => onDuplicate(b.id)}>Duplicate</SmallButton>
            <SmallButton
              onClick={() => {
                if (confirm(`Remove “${b.title || "this block"}”?`)) onRemove(b.id);
              }}
              className="text-red-700 hover:bg-red-50"
            >
              Remove
            </SmallButton>
          </div>
        </div>
      ) : null}
    </li>
  );
});

function SmallButton({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "h-8 rounded-lg px-2.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 ring-inset hover:bg-zinc-50 disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

/** Number field that lets you clear and retype; commits valid 1–240 values as you type. */
function MinutesInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="relative">
      <input
        aria-label="Minutes"
        type="number"
        inputMode="numeric"
        min={1}
        max={240}
        value={draft ?? String(value)}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Math.round(Number(e.target.value));
          if (e.target.value !== "" && Number.isFinite(n) && n >= 1) onChange(Math.min(240, n));
        }}
        onBlur={() => setDraft(null)}
        className="h-9 w-12 border-0 bg-surface pr-4 text-center text-base tabular-nums ring-1 ring-zinc-200 ring-inset [appearance:textfield] focus:ring-2 focus:ring-brand-600 sm:text-sm [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-[10px] text-zinc-400"
      >
        m
      </span>
    </div>
  );
}
