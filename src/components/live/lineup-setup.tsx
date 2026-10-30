"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { startLiveScoring } from "@/lib/live-actions";
import type { HomeAway } from "@/lib/games";
import { cn } from "@/lib/utils";

type P = { id: string; name: string };
export type PitcherOption = P & {
  isPitcher: boolean;
  /** From Player Health on the game date. */
  status: "ready" | "rest" | "pain" | "unknown";
  detail: string;
};

const STATUS_STYLE: Record<PitcherOption["status"], string> = {
  ready: "bg-brand-50 text-brand-800",
  unknown: "bg-zinc-100 text-zinc-600",
  rest: "bg-amber-50 text-amber-800",
  pain: "bg-red-50 text-red-700",
};
const STATUS_ICON: Record<PitcherOption["status"], string> = {
  ready: "✓",
  unknown: "✓",
  rest: "⏸",
  pain: "⛔",
};

function Step({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-zinc-900 text-sm font-bold text-zinc-50">
          {n}
        </span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          {hint ? <p className="text-sm text-zinc-600">{hint}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Before the first pitch: who's pitching, the batting order, and who bats first. */
export function LineupSetup({
  gameId,
  roster,
  defaultLineup,
  pitchers,
  homeAway,
}: {
  gameId: string;
  roster: P[];
  defaultLineup: string[];
  pitchers: PitcherOption[];
  homeAway: HomeAway;
}) {
  const router = useRouter();
  const [lineup, setLineup] = useState<string[]>(defaultLineup);
  const [pitcher, setPitcher] = useState<string>("");
  const [showAll, setShowAll] = useState(!pitchers.some((p) => p.isPitcher));
  const [weFirst, setWeFirst] = useState(homeAway === "away");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const name = (id: string) => roster.find((p) => p.id === id)?.name ?? "Player";
  const bench = roster.filter((p) => !lineup.includes(p.id));
  const chosen = pitchers.find((p) => p.id === pitcher);
  const shown = showAll ? pitchers : pitchers.filter((p) => p.isPitcher || p.id === pitcher);
  const missing = [
    !pitcher && "pick a pitcher",
    !lineup.length && "add at least one batter",
  ].filter(Boolean);

  const move = (i: number, d: number) =>
    setLineup((l) => {
      const n = [...l];
      const j = i + d;
      if (j < 0 || j >= n.length) return l;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <div className="space-y-4">
      <Step n={1} title="Who's pitching?" hint="Status comes from Player Health for the game day.">
        <fieldset>
          <legend className="sr-only">Starting pitcher</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {shown.map((p) => (
              <label
                key={p.id}
                className={cn(
                  "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ring-1 transition-colors",
                  pitcher === p.id
                    ? "bg-brand-50 ring-2 ring-brand-600"
                    : "bg-surface ring-zinc-200 hover:bg-zinc-50",
                )}
              >
                <input
                  type="radio"
                  name="pitcher"
                  value={p.id}
                  checked={pitcher === p.id}
                  onChange={() => setPitcher(p.id)}
                  className="size-5 accent-brand-700"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span
                    className={cn(
                      "mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-semibold",
                      STATUS_STYLE[p.status],
                    )}
                  >
                    {STATUS_ICON[p.status]} {p.detail}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {pitchers.some((p) => !p.isPitcher) ? (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="min-h-11 text-sm font-semibold text-brand-700"
          >
            {showAll ? "Show pitchers only" : "Show everyone"}
          </button>
        ) : null}
        {chosen && (chosen.status === "rest" || chosen.status === "pain") ? (
          <p
            role="alert"
            className={cn(
              "rounded-xl px-3 py-2 text-sm",
              chosen.status === "pain" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900",
            )}
          >
            {chosen.status === "pain"
              ? `${chosen.name.split(" ")[0]} reported arm pain. Check in with them (and a trainer if needed) before they throw.`
              : `${chosen.name.split(" ")[0]} should be resting under Pitch Smart (${chosen.detail.toLowerCase()}). You can still start them; it's your call.`}
          </p>
        ) : null}
      </Step>

      <Step
        n={2}
        title="Batting order"
        hint="Starts from your last game. Use the arrows to reorder."
      >
        {lineup.length === 0 ? (
          <p className="text-sm text-zinc-500">Tap players on the bench to add them in order.</p>
        ) : (
          <ol
            className="divide-y divide-zinc-100 rounded-xl ring-1 ring-zinc-200"
            aria-label="Batting order"
          >
            {lineup.map((id, i) => (
              <li key={id} className="flex items-center gap-2 px-3 py-1.5">
                <span className="w-6 text-sm font-semibold text-zinc-500">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{name(id)}</span>
                <button
                  type="button"
                  aria-label={`Move ${name(id)} up`}
                  onClick={() => move(i, -1)}
                  className="size-11 rounded-md text-zinc-600 hover:bg-zinc-100"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move ${name(id)} down`}
                  onClick={() => move(i, 1)}
                  className="size-11 rounded-md text-zinc-600 hover:bg-zinc-100"
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${name(id)}`}
                  onClick={() => setLineup((l) => l.filter((x) => x !== id))}
                  className="size-11 rounded-md text-zinc-500 hover:bg-red-50 hover:text-red-700"
                >
                  ✕
                </button>
              </li>
            ))}
          </ol>
        )}
        {bench.length ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              Bench · tap to add
            </p>
            <div className="flex flex-wrap gap-2">
              {bench.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setLineup((l) => [...l, p.id])}
                  className="h-11 rounded-full bg-surface px-4 text-sm font-medium ring-1 ring-zinc-300 hover:bg-zinc-50"
                >
                  + {p.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </Step>

      <Step
        n={3}
        title="Who bats first?"
        hint={`Set from the schedule (${homeAway === "home" ? "home game" : homeAway === "away" ? "away game" : "neutral site"}). Change it if that's wrong.`}
      >
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">Who bats first</legend>
          {[
            { first: true, title: "We bat first", sub: "We're the visitors (top of each inning)" },
            { first: false, title: "We bat second", sub: "We're home (bottom of each inning)" },
          ].map((o) => (
            <label
              key={String(o.first)}
              className={cn(
                "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ring-1",
                weFirst === o.first
                  ? "bg-brand-50 ring-2 ring-brand-600"
                  : "bg-surface ring-zinc-200 hover:bg-zinc-50",
              )}
            >
              <input
                type="radio"
                name="batsFirst"
                checked={weFirst === o.first}
                onChange={() => setWeFirst(o.first)}
                className="size-5 accent-brand-700"
              />
              <span>
                <span className="block font-medium">{o.title}</span>
                <span className="block text-xs text-zinc-500">{o.sub}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </Step>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="space-y-2">
        <Button
          type="button"
          disabled={pending || missing.length > 0}
          className="h-14 w-full text-base"
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
          {pending ? "Starting…" : "▶ Play ball"}
        </Button>
        {missing.length ? (
          <p className="text-center text-sm text-zinc-500">To start, {missing.join(" and ")}.</p>
        ) : null}
      </div>
    </div>
  );
}
