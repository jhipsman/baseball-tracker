"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Day = { date: string; competitive: number; other: number; armFeel: string | null };

const COMPETITIVE = "#2a78d6"; // categorical slot 1 (validated)
const OTHER = "#eb6834"; // categorical slot 2 (validated)

/**
 * Daily throwing volume as columns: competitive pitches (games + live ABs) and
 * other throwing stacked, with a 2px surface gap. Hover/focus a day for details.
 */
export function ThrowsChart({ days, dailyMax }: { days: Day[]; dailyMax: number | null }) {
  const [active, setActive] = useState<number | null>(null);
  const H = 140;
  const max = Math.max(dailyMax ?? 0, ...days.map((d) => d.competitive + d.other), 10);
  const scale = (v: number) => (v / max) * (H - 16);
  const a = active != null ? days[active] : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-3 text-xs text-zinc-600">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm" style={{ background: COMPETITIVE }} />
          Games &amp; live ABs
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm" style={{ background: OTHER }} />
          Bullpens &amp; throwing
        </span>
        {dailyMax ? (
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-px w-4 bg-red-500" />
            Pitch Smart daily max ({dailyMax})
          </span>
        ) : null}
      </div>
      <div className="relative">
        <div
          className="flex items-end gap-0.5"
          style={{ height: H }}
          role="img"
          aria-label={`Daily throws for the last ${days.length} days`}
          onPointerLeave={() => setActive(null)}
        >
          {dailyMax ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 border-t border-red-500"
              style={{ bottom: scale(dailyMax) }}
            />
          ) : null}
          {days.map((d, i) => (
            <button
              key={d.date}
              type="button"
              aria-label={`${d.date}: ${d.competitive} competitive, ${d.other} other throws${d.armFeel ? `, arm ${d.armFeel}` : ""}`}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className={cn(
                "flex h-full min-w-0 flex-1 flex-col justify-end rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-600",
                i === active && "bg-zinc-100",
              )}
            >
              {d.other > 0 ? (
                <span
                  className="block w-full rounded-t-[3px]"
                  style={{
                    height: scale(d.other),
                    background: OTHER,
                    marginBottom: d.competitive > 0 ? 2 : 0,
                  }}
                />
              ) : null}
              {d.competitive > 0 ? (
                <span
                  className={cn("block w-full", d.other > 0 ? "" : "rounded-t-[3px]")}
                  style={{ height: scale(d.competitive), background: COMPETITIVE }}
                />
              ) : null}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-zinc-500">
          <span>{days[0]?.date.slice(5)}</span>
          <span>{days.at(-1)?.date.slice(5)}</span>
        </div>
        {a ? (
          <div
            role="status"
            className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 rounded-lg bg-white px-3 py-1.5 text-xs whitespace-nowrap shadow-lg ring-1 ring-zinc-200"
          >
            <span className="font-semibold text-zinc-900">{a.competitive + a.other} throws</span>
            <span className="text-zinc-500">
              {" "}
              · {a.date}
              {a.competitive ? ` · ${a.competitive} competitive` : ""}
              {a.armFeel ? ` · arm ${a.armFeel}` : ""}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
