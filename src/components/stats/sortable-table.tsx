"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type Column = {
  key: string;
  label: string;
  /** Full name for the header tooltip / screen readers. */
  title?: string;
  /** Lower is better (ERA, WHIP): first click sorts ascending. */
  lowFirst?: boolean;
};

export type Cell = { v: number | null; d: string };
export type Row = {
  id: string;
  name: string;
  href?: string;
  /** Doesn't qualify for rate-stat leaders: rate cells are dimmed. */
  dim?: boolean;
  highlight?: boolean;
  cells: Record<string, Cell>;
};

/**
 * Stats table with clickable column headers. The name column stays put while
 * the numbers scroll sideways on small screens.
 */
export function SortableTable({
  caption,
  columns,
  rows,
  totals,
  defaultSort,
  dimKeys = [],
  note,
}: {
  caption: string;
  columns: Column[];
  rows: Row[];
  totals?: Record<string, string>;
  defaultSort: string;
  /** Columns dimmed on rows with `dim` (rate stats). */
  dimKeys?: string[];
  note?: React.ReactNode;
}) {
  const initial = columns.find((c) => c.key === defaultSort);
  const [sort, setSort] = useState<{ key: string; asc: boolean }>({
    key: defaultSort,
    asc: Boolean(initial?.lowFirst),
  });

  const sorted = rows.toSorted((a, b) => {
    if (sort.key === "name")
      return sort.asc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    const x = a.cells[sort.key]?.v;
    const y = b.cells[sort.key]?.v;
    if (x == null && y == null) return a.name.localeCompare(b.name);
    if (x == null) return 1;
    if (y == null) return -1;
    // Unqualified rows sink below qualified ones on rate stats.
    if (dimKeys.includes(sort.key) && Boolean(a.dim) !== Boolean(b.dim)) return a.dim ? 1 : -1;
    return (sort.asc ? x - y : y - x) || a.name.localeCompare(b.name);
  });

  const click = (c: Column | { key: "name"; lowFirst: true }) =>
    setSort((s) =>
      s.key === c.key ? { key: c.key, asc: !s.asc } : { key: c.key, asc: Boolean(c.lowFirst) },
    );

  const aria = (key: string) =>
    sort.key === key ? (sort.asc ? "ascending" : "descending") : undefined;

  return (
    <div className="rounded-xl bg-white ring-1 ring-zinc-200">
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <caption className="px-3 pt-3 text-left text-sm font-semibold sm:px-4">{caption}</caption>
          <thead>
            <tr className="border-b border-zinc-200 text-xs text-zinc-500">
              <th
                scope="col"
                aria-sort={aria("name")}
                className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-medium sm:px-4"
              >
                <button
                  type="button"
                  onClick={() => click({ key: "name", lowFirst: true })}
                  className="font-medium hover:text-zinc-900"
                >
                  Player{sort.key === "name" ? (sort.asc ? " ▲" : " ▼") : ""}
                </button>
              </th>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={aria(c.key)}
                  className="px-2 py-2 text-right font-medium whitespace-nowrap"
                >
                  <button
                    type="button"
                    title={c.title}
                    onClick={() => click(c)}
                    className={cn(
                      "font-medium hover:text-zinc-900",
                      sort.key === c.key && "text-zinc-900",
                    )}
                  >
                    {c.label}
                    {sort.key === c.key ? (sort.asc ? " ▲" : " ▼") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.id}
                className={cn(
                  "border-b border-zinc-100 last:border-0",
                  r.highlight && "bg-brand-50",
                )}
              >
                <th
                  scope="row"
                  className={cn(
                    "sticky left-0 z-10 max-w-40 truncate px-3 py-2 text-left font-medium sm:px-4",
                    r.highlight ? "bg-brand-50" : "bg-white",
                  )}
                >
                  {r.href ? (
                    <Link href={r.href} className="hover:underline">
                      {r.name}
                    </Link>
                  ) : (
                    r.name
                  )}
                </th>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-2 py-2 text-right",
                      sort.key === c.key && "font-semibold",
                      r.dim && dimKeys.includes(c.key) && "text-zinc-400",
                    )}
                  >
                    {r.cells[c.key]?.d ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {totals ? (
            <tfoot>
              <tr className="border-t border-zinc-300 font-semibold">
                <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-2 text-left sm:px-4">
                  Team
                </th>
                {columns.map((c) => (
                  <td key={c.key} className="px-2 py-2 text-right">
                    {totals[c.key] ?? ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {note ? (
        <p className="border-t border-zinc-100 px-3 py-2 text-xs text-zinc-500 sm:px-4">{note}</p>
      ) : null}
    </div>
  );
}
