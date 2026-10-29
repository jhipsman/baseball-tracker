"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { selectClass } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PA_RESULTS, type Result } from "@/lib/live/engine";
import {
  finishLiveGame,
  recordPitch,
  recordPlay,
  undoLastPlay,
  type PitchKind,
  type PlayInput,
} from "@/lib/live-actions";

type P = { id: string; name: string };

export type SmartStatus = {
  ages: string;
  dailyMax: number;
  left: number;
  restNow: number;
  untilMoreRest: number | null;
  restAfterNext: number;
  over: boolean;
} | null;

export type ScorerProps = {
  gameId: string;
  final: boolean;
  inningLabel: string;
  outs: number;
  weBat: boolean;
  us: number;
  them: number;
  opponent: string;
  lineup: P[];
  batterIdx: number;
  pitcher: P | null;
  pitches: number;
  balls: number;
  strikes: number;
  smart: SmartStatus;
  hasBirthdate: boolean;
  roster: P[];
  feed: { seq: number; label: string; text: string }[];
};

const HIT = new Set(["1B", "2B", "3B", "HR"]);
const ON_BASE = new Set(["BB", "IBB", "HBP", "E", "FC"]);

function Stepper({
  label,
  value,
  set,
  max,
}: {
  label: string;
  value: number;
  set: (n: number) => void;
  max: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-zinc-700">{label}</span>
      <button
        type="button"
        aria-label={`Fewer ${label}`}
        onClick={() => set(Math.max(0, value - 1))}
        className="size-9 rounded-lg bg-zinc-100 text-lg font-semibold"
      >
        −
      </button>
      <span className="w-5 text-center font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label={`More ${label}`}
        onClick={() => set(Math.min(max, value + 1))}
        className="size-9 rounded-lg bg-zinc-100 text-lg font-semibold"
      >
        +
      </button>
    </div>
  );
}

export function Scorer(props: ScorerProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState(0);
  const [rbi, setRbi] = useState(0);
  const [unearned, setUnearned] = useState(0);
  const [extraOuts, setExtraOuts] = useState(0);
  const [scored, setScored] = useState<string[]>([]);
  const [tool, setTool] = useState<"" | "steal" | "sub" | "pitcher" | "close">("");
  const [pick, setPick] = useState("");
  const [slot, setSlot] = useState(1);
  const [closeRuns, setCloseRuns] = useState(0);

  const batter = props.weBat ? props.lineup[props.batterIdx] : null;
  const onDeck = props.weBat ? props.lineup[(props.batterIdx + 1) % props.lineup.length] : null;

  function reset() {
    setRuns(0);
    setRbi(0);
    setUnearned(0);
    setExtraOuts(0);
    setScored([]);
    setTool("");
    setPick("");
    setCloseRuns(0);
  }

  function run(fn: () => Promise<{ error?: string }>, after = reset) {
    start(async () => {
      setError(null);
      const res = await fn();
      if (res.error) setError(res.error);
      else {
        after();
        router.refresh();
      }
    });
  }

  const play = (input: PlayInput) => run(() => recordPlay(props.gameId, input));
  const pitch = (k: PitchKind) =>
    run(
      () => recordPitch(props.gameId, k),
      () => {},
    );

  const result = (r: Result) =>
    play({
      kind: "pa",
      result: r,
      runs: r === "HR" ? Math.max(runs, 1) : runs,
      rbi: props.weBat ? (r === "HR" ? Math.max(rbi, 1) : rbi) : 0,
      unearned,
      scored,
      extraOuts,
    });

  const smart = props.smart;
  const warn = smart && (smart.over || (smart.untilMoreRest != null && smart.untilMoreRest <= 5));

  return (
    <div className="space-y-4">
      {/* Scoreboard */}
      <section className="flex items-center justify-between rounded-2xl bg-zinc-900 px-4 py-3 text-white">
        <div>
          <p className="text-xs tracking-wide text-zinc-400 uppercase">{props.inningLabel}</p>
          <div className="mt-1 flex gap-1" aria-label={`${props.outs} outs`}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={cn(
                  "size-3 rounded-full",
                  i < props.outs ? "bg-amber-400" : "bg-zinc-700",
                )}
              />
            ))}
          </div>
        </div>
        <p className="text-2xl font-semibold tabular-nums">
          Us {props.us} – {props.them} {props.opponent}
        </p>
      </section>

      {props.final ? (
        <p className="rounded-lg bg-zinc-100 px-3 py-2 text-sm">
          This game is final. Undo the last play or resume it from the game page to make changes.
        </p>
      ) : null}

      {/* Who's up / who's pitching */}
      {props.weBat ? (
        <section className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
          <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
            Now batting · {props.batterIdx + 1}
          </p>
          <p className="text-xl font-semibold">{batter ? batter.name : "—"}</p>
          {onDeck && onDeck !== batter ? (
            <p className="text-sm text-zinc-500">On deck: {onDeck.name}</p>
          ) : null}
        </section>
      ) : (
        <section
          className={cn(
            "space-y-3 rounded-2xl p-4 ring-1",
            smart?.over
              ? "bg-red-50 ring-red-300"
              : warn
                ? "bg-amber-50 ring-amber-300"
                : "bg-white ring-zinc-200",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
                Pitching
              </p>
              <p className="text-xl font-semibold">{props.pitcher?.name ?? "Choose a pitcher"}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold tabular-nums">{props.pitches}</p>
              <p className="text-xs text-zinc-500">pitches</p>
            </div>
          </div>
          {smart ? (
            <p className="text-sm text-zinc-800" data-testid="pitch-smart">
              {smart.over ? (
                <strong>
                  Over the Pitch Smart daily max ({smart.dailyMax}, ages {smart.ages}).
                </strong>
              ) : (
                <>
                  {smart.left} left today (max {smart.dailyMax}).{" "}
                  {smart.restNow === 0
                    ? "No rest needed if he stops now."
                    : `Stop now: ${smart.restNow} day${smart.restNow === 1 ? "" : "s"} rest.`}{" "}
                  {smart.untilMoreRest != null ? (
                    <strong>
                      {smart.untilMoreRest} more → {smart.restAfterNext} day
                      {smart.restAfterNext === 1 ? "" : "s"} rest.
                    </strong>
                  ) : null}
                </>
              )}
            </p>
          ) : props.pitcher && !props.hasBirthdate ? (
            <p className="text-sm text-zinc-600">
              Add his birthdate on his profile to get Pitch Smart warnings.
            </p>
          ) : null}
          <p className="text-sm font-medium" aria-live="polite">
            Count {props.balls}-{props.strikes}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                ["ball", "Ball"],
                ["called", "Called strike"],
                ["swinging", "Swinging strike"],
                ["foul", "Foul"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                disabled={pending || !props.pitcher}
                onClick={() => pitch(k)}
                className={cn(
                  "h-12 rounded-xl text-sm font-semibold disabled:opacity-50",
                  k === "ball" ? "bg-sky-100 text-sky-900" : "bg-rose-100 text-rose-900",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-3 text-xs text-zinc-500">
            <button type="button" onClick={() => pitch("minus")} disabled={pending}>
              −1 pitch
            </button>
            <button type="button" onClick={() => pitch("reset")} disabled={pending}>
              Reset count
            </button>
            <span>Pitch-by-pitch is optional: you can just tap the result.</span>
          </div>
        </section>
      )}

      {/* Result of the at-bat */}
      <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
        <h2 className="font-semibold">{props.weBat ? "Result" : "Result for their batter"}</h2>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Stepper label="Runs scored" value={runs} set={setRuns} max={4} />
          {props.weBat ? (
            <Stepper label="RBI" value={rbi} set={setRbi} max={4} />
          ) : (
            <Stepper label="Unearned" value={unearned} set={setUnearned} max={runs} />
          )}
          <Stepper label="Extra outs on bases" value={extraOuts} set={setExtraOuts} max={2} />
        </div>
        {props.weBat && runs > 0 ? (
          <div>
            <p className="mb-1 text-xs text-zinc-500">Who scored? (for runs per player)</p>
            <div className="flex flex-wrap gap-1.5">
              {props.lineup.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={scored.includes(p.id)}
                  onClick={() =>
                    setScored((s) =>
                      s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id].slice(0, runs),
                    )
                  }
                  className={cn(
                    "h-9 rounded-full px-3 text-sm",
                    scored.includes(p.id) ? "bg-brand-700 text-white" : "bg-zinc-100 text-zinc-800",
                  )}
                >
                  {p.name.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {PA_RESULTS.map((r) => (
            <button
              key={r.key}
              type="button"
              title={r.long}
              aria-label={r.long}
              disabled={pending || (!props.weBat && !props.pitcher) || (props.weBat && !batter)}
              onClick={() => result(r.key)}
              className={cn(
                "h-12 rounded-xl text-base font-semibold disabled:opacity-50",
                HIT.has(r.key)
                  ? "bg-brand-100 text-brand-900"
                  : ON_BASE.has(r.key)
                    ? "bg-sky-100 text-sky-900"
                    : "bg-zinc-100 text-zinc-900",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </section>

      {/* Other plays */}
      <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
        <div className="flex flex-wrap gap-2">
          {props.weBat ? (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setTool(tool === "steal" ? "" : "steal")}
              >
                Stolen base / caught
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setTool(tool === "sub" ? "" : "sub")}
              >
                Substitution
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setTool(tool === "pitcher" ? "" : "pitcher")}
              >
                Pitching change
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => play({ kind: "steal", result: "CS" })}
              >
                Runner caught stealing
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => setTool(tool === "close" ? "" : "close")}
          >
            End this half
          </Button>
        </div>

        {tool === "steal" ? (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className={selectClass}
              aria-label="Runner"
            >
              <option value="">Runner…</option>
              {props.lineup.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              disabled={!pick || pending}
              onClick={() => play({ kind: "steal", result: "SB", playerId: pick })}
            >
              Stole
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!pick || pending}
              onClick={() => play({ kind: "steal", result: "CS", playerId: pick })}
            >
              Caught
            </Button>
          </div>
        ) : null}

        {tool === "sub" ? (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={slot}
              onChange={(e) => setSlot(Number(e.target.value))}
              className={selectClass}
              aria-label="Lineup spot"
            >
              {props.lineup.map((p, i) => (
                <option key={p.id + i} value={i + 1}>
                  {i + 1}. {p.name} out
                </option>
              ))}
            </select>
            <select
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className={selectClass}
              aria-label="Coming in"
            >
              <option value="">Coming in…</option>
              {props.roster
                .filter((p) => !props.lineup.some((l) => l.id === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <Button
              type="button"
              disabled={!pick || pending}
              onClick={() => play({ kind: "sub", slot, playerId: pick })}
            >
              Make change
            </Button>
          </div>
        ) : null}

        {tool === "pitcher" ? (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className={selectClass}
              aria-label="New pitcher"
            >
              <option value="">New pitcher…</option>
              {props.roster
                .filter((p) => p.id !== props.pitcher?.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <Button
              type="button"
              disabled={!pick || pending}
              onClick={() => play({ kind: "sub", playerId: pick })}
            >
              Bring him in
            </Button>
          </div>
        ) : null}

        {tool === "close" ? (
          <div className="flex flex-wrap items-center gap-3">
            <Stepper
              label={props.weBat ? "We scored" : "They scored"}
              value={closeRuns}
              set={setCloseRuns}
              max={30}
            />
            <Button
              type="button"
              disabled={pending}
              onClick={() => play({ kind: "half_end", runs: closeRuns })}
            >
              End half
            </Button>
            <p className="w-full text-xs text-zinc-500">
              For when you didn&apos;t log every at-bat. Adds these runs and moves to the next half.
            </p>
          </div>
        ) : null}
      </section>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={pending || props.feed.length === 0}
          onClick={() => run(() => undoLastPlay(props.gameId))}
        >
          ↶ Undo last play
        </Button>
        {!props.final ? (
          <Button
            type="button"
            className="ml-auto"
            disabled={pending}
            onClick={() => {
              if (confirm("End the game with this score? Players and parents get the final.")) {
                run(() => finishLiveGame(props.gameId));
              }
            }}
          >
            End game
          </Button>
        ) : null}
      </div>

      <section aria-label="Recent plays" className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
        <h2 className="mb-2 font-semibold">Recent plays</h2>
        {props.feed.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing yet. Play ball!</p>
        ) : (
          <ol className="space-y-1 text-sm">
            {props.feed.map((f) => (
              <li key={f.seq} className="flex gap-2">
                <span className="w-16 shrink-0 text-xs text-zinc-500">{f.label}</span>
                <span>{f.text}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
