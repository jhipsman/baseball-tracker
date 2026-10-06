"use client";

import { useOptimistic, useTransition } from "react";
import { SEASON_PHASE_LABELS, SEASON_PHASES } from "@/constants";
import { setSeasonPhase } from "@/lib/season-actions";
import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database";

type Phase = Enums<"season_phase">;

/** Segmented control for the org's current season; staff can change it, others just see it. */
export function SeasonToggle({ phase, editable }: { phase: Phase; editable: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(phase);
  const [, startTransition] = useTransition();

  return (
    <div
      role="radiogroup"
      aria-label="Current season"
      className="grid w-full grid-cols-2 gap-0.5 rounded-lg bg-zinc-100 p-0.5 text-xs font-medium"
    >
      {SEASON_PHASES.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={optimistic === p}
          disabled={!editable}
          onClick={() =>
            startTransition(async () => {
              setOptimistic(p);
              const fd = new FormData();
              fd.set("phase", p);
              await setSeasonPhase(fd);
            })
          }
          className={cn(
            "rounded-md px-2 py-1.5 whitespace-nowrap",
            optimistic === p ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500",
            editable ? "hover:text-zinc-900" : "cursor-default",
          )}
        >
          {SEASON_PHASE_LABELS[p]}
        </button>
      ))}
    </div>
  );
}
