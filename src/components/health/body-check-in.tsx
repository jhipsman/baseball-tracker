"use client";

import { useState, useTransition } from "react";
import { saveBodyCheckin } from "@/lib/health-actions";
import { FEELS, feelOf, SLEEPS, spotName, type BodyCheckin, type Sleep } from "@/lib/body";
import { cn } from "@/lib/utils";
import { BodyMap } from "./body-map";

const MINUTES = [30, 60, 90, 120, 150];
const effortWord = (r: number) =>
  r <= 2 ? "very easy" : r <= 4 ? "easy" : r <= 6 ? "moderate" : r <= 8 ? "hard" : "max effort";

/**
 * About ten seconds on the player's home page: one tap for how they feel
 * overall, then (optional) tap anything sore and how they slept.
 */
export function BodyCheckIn({ today, current }: { today: string; current: BodyCheckin | null }) {
  const [feel, setFeel] = useState<number | null>(current?.feel ?? null);
  const [sore, setSore] = useState<string[]>(current?.sore ?? []);
  const [sleep, setSleep] = useState<Sleep | null>(current?.sleep ?? null);
  const [minutes, setMinutes] = useState<number | null>(current?.session?.minutes ?? null);
  const [rpe, setRpe] = useState<number>(current?.session?.rpe ?? 5);
  const session = minutes ? { minutes, rpe } : null;
  const [stage, setStage] = useState<"feel" | "details" | "done">(current ? "done" : "feel");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  function save(
    next: {
      feel: number;
      sore: string[];
      sleep: Sleep | null;
      session: { minutes: number; rpe: number } | null;
    },
    then: typeof stage,
  ) {
    setError("");
    start(async () => {
      const res = await saveBodyCheckin({ date: today, ...next });
      if (res.error) setError(res.error);
      else setStage(then);
    });
  }

  if (stage === "done" && feel) {
    const f = feelOf(feel);
    return (
      <section
        aria-label="Body check-in"
        className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200"
      >
        <span aria-hidden className="text-2xl">
          {f.face}
        </span>
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">Feeling {f.label.toLowerCase()} today.</span>{" "}
          {sore.length ? `Sore: ${sore.map(spotName).join(", ")}.` : "Nothing sore."}
          {sleep ? ` Slept ${SLEEPS.find((s) => s.key === sleep)!.label}.` : ""}
          {session ? ` Team session: ${session.minutes} min at ${session.rpe}/10.` : ""}
        </p>
        <button
          type="button"
          onClick={() => setStage("details")}
          className="min-h-11 text-sm font-semibold text-brand-700"
        >
          Change
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="body-q" className="rounded-2xl bg-surface p-4 ring-1 ring-zinc-200">
      <h2 id="body-q" className="font-semibold">
        How do you feel overall?
      </h2>
      <p className="text-sm text-zinc-600">Your whole body, not just your arm.</p>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {FEELS.map((f) => (
          <button
            key={f.value}
            type="button"
            disabled={pending}
            aria-pressed={feel === f.value}
            onClick={() => {
              setFeel(f.value);
              save({ feel: f.value, sore, sleep, session }, "details");
            }}
            className={cn(
              "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold ring-1 ring-zinc-200 transition-transform active:scale-95 disabled:opacity-60 sm:text-sm",
              feel === f.value ? f.className : "bg-surface hover:bg-zinc-50",
            )}
          >
            <span aria-hidden className="text-xl">
              {f.face}
            </span>
            {f.label}
          </button>
        ))}
      </div>

      {stage === "details" && feel ? (
        <div className="mt-4 space-y-4 border-t border-zinc-100 pt-4">
          <div>
            <p className="text-sm font-semibold">
              Anything sore? <span className="font-normal text-zinc-600">Tap where. Optional.</span>
            </p>
            <BodyMap
              label="Sore spots"
              selected={sore}
              disabled={pending}
              onToggle={(spot) =>
                setSore((s) => (s.includes(spot) ? s.filter((x) => x !== spot) : [...s, spot]))
              }
            />
            {sore.length ? (
              <p className="mt-1 text-center text-sm text-zinc-700">
                {sore.map(spotName).join(", ")}
              </p>
            ) : null}
          </div>
          <fieldset>
            <legend className="text-sm font-semibold">
              Sleep last night <span className="font-normal text-zinc-600">Optional.</span>
            </legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {SLEEPS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={sleep === s.key}
                  onClick={() => setSleep(sleep === s.key ? null : s.key)}
                  className={cn(
                    "min-h-11 rounded-xl text-sm font-semibold ring-1",
                    sleep === s.key
                      ? "bg-zinc-900 text-zinc-50 ring-zinc-900"
                      : "bg-surface ring-zinc-200 hover:bg-zinc-50",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-semibold">
              Team practice or game today?{" "}
              <span className="font-normal text-zinc-600">Optional. Not workouts you logged.</span>
            </legend>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={minutes === m}
                  onClick={() => setMinutes(minutes === m ? null : m)}
                  className={cn(
                    "min-h-11 rounded-xl text-sm font-semibold ring-1",
                    minutes === m
                      ? "bg-zinc-900 text-zinc-50 ring-zinc-900"
                      : "bg-surface ring-zinc-200 hover:bg-zinc-50",
                  )}
                >
                  {m === 150 ? "2 h +" : `${m}m`}
                </button>
              ))}
            </div>
            {minutes ? (
              <label className="mt-3 block text-sm font-medium">
                How hard? <span className="font-semibold">{rpe}/10</span>{" "}
                <span className="font-normal text-zinc-600">({effortWord(rpe)})</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={rpe}
                  onChange={(e) => setRpe(Number(e.target.value))}
                  className="mt-2 block h-11 w-full accent-brand-700"
                />
              </label>
            ) : null}
          </fieldset>
          <button
            type="button"
            disabled={pending}
            onClick={() => save({ feel, sore, sleep, session }, "done")}
            className="h-12 w-full rounded-full bg-brand-700 font-semibold text-on-brand disabled:opacity-50"
          >
            {pending ? "Saving…" : "Done"}
          </button>
        </div>
      ) : pending ? (
        <p className="mt-2 text-sm text-zinc-500">Saving…</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
