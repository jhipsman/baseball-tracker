"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { endGame, resumeGame, saveLiveScore, startGame } from "@/lib/game-actions";
import {
  addRuns,
  ensureInnings,
  lineTotals,
  MAX_INNINGS,
  type GameStatus,
  type Inning,
} from "@/lib/games";
import { Button } from "@/components/ui/button";
import { LineScoreTable } from "./game-ui";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  status: GameStatus;
  opponent: string;
  teamName: string;
  lineScore: Inning[];
  currentInning: number | null;
  inningsScheduled: number;
  teamScore: number | null;
  opponentScore: number | null;
  /** Shown under Start game before the game begins: the other way to keep score. */
  alternative?: ReactNode;
};

/**
 * Dugout scoring: big +/– buttons for the current inning, inning stepper,
 * live line score, and End game → final. Every tap updates the screen at once
 * and saves in the background (taps made while a save is running are batched).
 */
export function LiveScoring(props: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<GameStatus>(props.status);
  const [line, setLine] = useState<Inning[]>(props.lineScore);
  const [inning, setInning] = useState(props.currentInning ?? 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [pending, start] = useTransition();

  const latest = useRef<{ line: Inning[]; inning: number } | null>(null);
  const inflight = useRef<Promise<void> | null>(null);

  const flush = async () => {
    setSaving(true);
    let failed: string | null = null;
    while (latest.current) {
      const s = latest.current;
      latest.current = null;
      const r = await saveLiveScore(props.id, s.line, s.inning);
      failed = r.error ?? null;
    }
    inflight.current = null;
    setSaving(false);
    setError(failed);
  };
  const queue = (nextLine: Inning[], nextInning: number) => {
    setLine(nextLine);
    setInning(nextInning);
    latest.current = { line: nextLine, inning: nextInning };
    if (!inflight.current) inflight.current = flush();
  };

  const totals = lineTotals(line);
  const game = {
    lineScore: line,
    inningsScheduled: props.inningsScheduled,
    opponent: props.opponent,
    status,
  };

  const run = (fn: () => Promise<{ error?: string }>, after?: () => void) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
      else {
        after?.();
        router.refresh();
      }
    });
  };

  if (status === "postponed" || status === "canceled") return null;

  if (status === "scheduled") {
    return (
      <section className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200">
        <h2 className="font-semibold">Live scoring</h2>
        <p className="text-sm text-zinc-600">
          Keep score from the dugout. Players and parents watching the game page see it update.
          {props.alternative ? " Pick one way to score:" : null}
        </p>
        <Button
          type="button"
          className="h-14 w-full text-base"
          disabled={pending}
          onClick={() =>
            run(
              () => startGame(props.id),
              () => {
                setStatus("live");
                setLine((l) => (l.length ? l : [{ us: 0, them: 0 }]));
              },
            )
          }
        >
          ▶ Start game
        </Button>
        {props.alternative ? (
          <>
            <p className="-mt-1 text-center text-sm text-zinc-600">Runs by inning only</p>
            {props.alternative}
          </>
        ) : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </section>
    );
  }

  if (status === "final" && !ending) {
    return (
      <section className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Final score</h2>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setEnding(true)}>
              Edit final score
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                run(
                  () => resumeGame(props.id),
                  () => setStatus("live"),
                )
              }
            >
              Resume scoring
            </Button>
          </div>
        </div>
        <LineScoreTable game={game} teamName={props.teamName} />
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </section>
    );
  }

  return (
    <section
      data-testid="live-scoring"
      className="space-y-4 rounded-2xl bg-surface p-4 ring-2 ring-red-500"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          {status === "live" ? (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white uppercase">
              Live
            </span>
          ) : null}
          {status === "live" ? "Scoring" : "Correct the score"}
        </h2>
        <span className="text-xs text-zinc-500" aria-live="polite">
          {saving ? "Saving…" : error ? "" : "Saved"}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="secondary"
          aria-label="Previous inning"
          className="size-14 text-2xl"
          disabled={inning <= 1}
          onClick={() => queue(line, inning - 1)}
        >
          ‹
        </Button>
        <div className="text-center">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Inning</p>
          <p className="text-4xl font-bold tabular-nums" data-testid="current-inning">
            {inning}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          aria-label="Next inning"
          className="size-14 text-2xl"
          disabled={inning >= MAX_INNINGS}
          onClick={() => queue(ensureInnings(line, inning + 1), inning + 1)}
        >
          ›
        </Button>
      </div>

      <div className="grid gap-3">
        {(
          [
            ["us", props.teamName],
            ["them", props.opponent],
          ] as const
        ).map(([side, name]) => {
          const inInning = ensureInnings(line, inning)[inning - 1][side];
          return (
            <div
              key={side}
              className={cn(
                "flex items-center gap-3 rounded-xl p-3",
                side === "us" ? "bg-brand-50" : "bg-zinc-100",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{name}</p>
                <p className="text-xs text-zinc-600">
                  This inning: <span className="font-semibold tabular-nums">{inInning}</span> ·
                  Total{" "}
                  <span className="font-semibold tabular-nums" data-testid={`total-${side}`}>
                    {totals[side]}
                  </span>
                </p>
              </div>
              <button
                type="button"
                aria-label={`Take away a run from ${name}`}
                disabled={inInning === 0}
                onClick={() => queue(addRuns(line, inning, side, -1), inning)}
                className="size-14 shrink-0 rounded-xl bg-surface text-3xl font-bold ring-1 ring-zinc-300 active:bg-zinc-100 disabled:opacity-40"
              >
                −
              </button>
              <button
                type="button"
                aria-label={`Run for ${name}`}
                data-testid={`add-run-${side}`}
                onClick={() => queue(addRuns(line, inning, side, 1), inning)}
                className={cn(
                  "size-14 shrink-0 rounded-xl text-3xl font-bold active:opacity-80",
                  side === "us" ? "bg-brand-700 text-on-brand" : "bg-neutral-700 text-white",
                )}
              >
                +
              </button>
            </div>
          );
        })}
      </div>

      <LineScoreTable game={game} teamName={props.teamName} currentInning={inning} />

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {ending ? (
        <EndGameForm
          id={props.id}
          line={line}
          initial={
            status === "final"
              ? { us: props.teamScore ?? totals.us, them: props.opponentScore ?? totals.them }
              : totals
          }
          teamName={props.teamName}
          opponent={props.opponent}
          onCancel={() => setEnding(false)}
          onDone={() => {
            setEnding(false);
            setStatus("final");
            router.refresh();
          }}
          waitFor={() => inflight.current ?? Promise.resolve()}
        />
      ) : (
        <Button
          type="button"
          variant="secondary"
          className="h-12 w-full"
          onClick={() => setEnding(true)}
        >
          End game…
        </Button>
      )}
    </section>
  );
}

function EndGameForm({
  id,
  line,
  initial,
  teamName,
  opponent,
  onCancel,
  onDone,
  waitFor,
}: {
  id: string;
  line: Inning[];
  initial: Inning;
  teamName: string;
  opponent: string;
  onCancel: () => void;
  onDone: () => void;
  waitFor: () => Promise<void>;
}) {
  const [us, setUs] = useState(String(initial.us));
  const [them, setThem] = useState(String(initial.them));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      await waitFor();
      const r = await endGame(id, Number(us), Number(them), line);
      if (r.error) setError(r.error);
      else onDone();
    });
  };
  const input =
    "block h-14 w-full rounded-lg border-0 bg-surface text-center text-2xl font-bold tabular-nums ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-brand-600";
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-zinc-50 p-3">
      <p className="text-sm font-semibold">Final score</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="block truncate text-xs font-medium text-zinc-600">{teamName}</span>
          <input
            type="number"
            min={0}
            max={99}
            required
            name="team_score"
            value={us}
            onChange={(e) => setUs(e.target.value)}
            className={input}
          />
        </label>
        <label className="space-y-1">
          <span className="block truncate text-xs font-medium text-zinc-600">{opponent}</span>
          <input
            type="number"
            min={0}
            max={99}
            required
            name="opponent_score"
            value={them}
            onChange={(e) => setThem(e.target.value)}
            className={input}
          />
        </label>
      </div>
      <p className="text-xs text-zinc-500">
        Defaults to the line score totals. Saving marks the game final and notifies players and
        parents.
      </p>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Saving…" : "Save final"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Back
        </Button>
      </div>
    </form>
  );
}
