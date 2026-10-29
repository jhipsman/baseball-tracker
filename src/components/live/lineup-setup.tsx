"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { selectClass } from "@/components/ui/select";
import { startLiveScoring } from "@/lib/live-actions";

type P = { id: string; name: string };

export function LineupSetup({
  gameId,
  roster,
  defaultLineup,
  defaultPitcher,
  defaultWeBatFirst,
}: {
  gameId: string;
  roster: P[];
  defaultLineup: string[];
  defaultPitcher: string | null;
  defaultWeBatFirst: boolean;
}) {
  const router = useRouter();
  const [lineup, setLineup] = useState<string[]>(defaultLineup);
  const [pitcher, setPitcher] = useState(defaultPitcher ?? "");
  const [weFirst, setWeFirst] = useState(defaultWeBatFirst);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const name = (id: string) => roster.find((p) => p.id === id)?.name ?? "Player";
  const bench = roster.filter((p) => !lineup.includes(p.id));

  const move = (i: number, d: number) =>
    setLineup((l) => {
      const n = [...l];
      const j = i + d;
      if (j < 0 || j >= n.length) return l;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h2 className="font-semibold">Batting order</h2>
        {lineup.length === 0 ? (
          <p className="text-sm text-zinc-500">Tap players below to add them in order.</p>
        ) : (
          <ol className="divide-y divide-zinc-100 rounded-xl bg-white ring-1 ring-zinc-200">
            {lineup.map((id, i) => (
              <li key={id} className="flex items-center gap-2 px-3 py-2">
                <span className="w-6 text-sm font-semibold text-zinc-500">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{name(id)}</span>
                <button
                  type="button"
                  aria-label={`Move ${name(id)} up`}
                  onClick={() => move(i, -1)}
                  className="size-9 rounded-md text-zinc-600 hover:bg-zinc-100"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move ${name(id)} down`}
                  onClick={() => move(i, 1)}
                  className="size-9 rounded-md text-zinc-600 hover:bg-zinc-100"
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${name(id)}`}
                  onClick={() => setLineup((l) => l.filter((x) => x !== id))}
                  className="size-9 rounded-md text-zinc-500 hover:bg-red-50 hover:text-red-700"
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
        )}
        {bench.length ? (
          <div className="flex flex-wrap gap-2">
            {bench.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setLineup((l) => [...l, p.id])}
                className="h-10 rounded-full bg-white px-3 text-sm font-medium ring-1 ring-zinc-300 hover:bg-zinc-50"
              >
                + {p.name}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-zinc-800">Starting pitcher</span>
          <select
            value={pitcher}
            onChange={(e) => setPitcher(e.target.value)}
            className={`${selectClass} w-full`}
          >
            <option value="">Choose…</option>
            {roster.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3 self-end text-sm font-medium text-zinc-800">
          <input
            type="checkbox"
            checked={weFirst}
            onChange={(e) => setWeFirst(e.target.checked)}
            className="size-5 accent-brand-700"
          />
          We bat first (top of the inning)
        </label>
      </section>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        disabled={pending || lineup.length === 0}
        className="w-full sm:w-auto"
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await startLiveScoring(gameId, {
              lineup,
              pitcherId: pitcher || null,
              weBatFirst: weFirst,
            });
            if (res.error) setError(res.error);
            else router.refresh();
          })
        }
      >
        {pending ? "Starting…" : "Start scoring"}
      </Button>
    </div>
  );
}
