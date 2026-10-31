"use client";

import { useState, useTransition } from "react";
import { saveHeights } from "@/lib/health-actions";
import { cn } from "@/lib/utils";

export type GrowthRow = {
  id: string;
  name: string;
  last: { date: string; inches: number } | null;
  /** Inches per year, if there's a height 2–7 months before the latest. */
  perYear: number | null;
  due: boolean;
  spurt: boolean;
};

const ftIn = (n: number) => `${Math.floor(n / 12)}′ ${(n % 12).toFixed(1).replace(/\.0$/, "")}″`;
const short = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/** Measure the team: one inches box per player, saved together. */
export function GrowthForm({ rows, today }: { rows: GrowthRow[]; today: string }) {
  const [date, setDate] = useState(today);
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const filled = Object.entries(values).filter(([, v]) => v.trim());

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        start(async () => {
          const res = await saveHeights(
            date,
            filled.map(([playerId, v]) => ({ playerId, inches: Number(v) })),
          );
          if (res.error) setMessage({ ok: false, text: res.error });
          else {
            setValues({});
            setMessage({
              ok: true,
              text: `Saved ${res.saved} height${res.saved === 1 ? "" : "s"}.`,
            });
          }
        });
      }}
    >
      <label className="block max-w-xs text-sm font-medium">
        Measured on
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 block h-11 w-full rounded-lg bg-surface px-3 ring-1 ring-zinc-300"
        />
      </label>
      <ul className="divide-y divide-zinc-100 rounded-2xl bg-surface ring-1 ring-zinc-200">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{r.name}</p>
              <p className="text-xs text-zinc-500">
                {r.last ? `${ftIn(r.last.inches)} on ${short(r.last.date)}` : "Not measured yet"}
                {r.perYear != null ? ` · ${r.perYear.toFixed(1)} in/yr` : ""}
              </p>
            </div>
            {r.spurt ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-950">
                Growth spurt
              </span>
            ) : r.due ? (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                Due
              </span>
            ) : null}
            <label className="flex items-center gap-1 text-sm">
              <span className="sr-only">Height in inches for {r.name}</span>
              <input
                inputMode="decimal"
                value={values[r.id] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [r.id]: e.target.value }))}
                placeholder={r.last ? String(r.last.inches) : "in"}
                aria-label={`Height in inches for ${r.name}`}
                className={cn(
                  "h-11 w-20 rounded-lg bg-surface px-2 text-right tabular-nums ring-1 ring-zinc-300",
                )}
              />
              in
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || !filled.length}
          className="h-11 rounded-full bg-brand-700 px-5 text-sm font-semibold text-on-brand disabled:opacity-50"
        >
          {pending
            ? "Saving…"
            : `Save ${filled.length || ""} height${filled.length === 1 ? "" : "s"}`}
        </button>
        {message ? (
          <span
            role="status"
            className={message.ok ? "text-sm text-brand-800" : "text-sm text-red-700"}
          >
            {message.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}
