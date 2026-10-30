"use client";

import { useState, useTransition } from "react";
import { logThrowing } from "@/lib/throwing-actions";
import { ARM_FEELS, type ArmFeelValue } from "@/constants/throwing";
import { cn } from "@/lib/utils";

const FACE: Record<ArmFeelValue, string> = {
  great: "💪",
  good: "🙂",
  okay: "😐",
  tired: "😮‍💨",
  sore: "😣",
  pain: "🚑",
};

/** One tap on the player's home page: how the arm feels today. Feeds Player Health. */
export function ArmCheckIn({ today, current }: { today: string; current: ArmFeelValue | null }) {
  const [feel, setFeel] = useState<ArmFeelValue | null>(current);
  const [editing, setEditing] = useState(!current);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  function pick(f: ArmFeelValue) {
    setError("");
    start(async () => {
      const res = await logThrowing({
        date: today,
        type: "check_in",
        pitches: 0,
        maxDistance: null,
        intensity: null,
        armFeel: f,
        pitchesByType: null,
        notes: "",
      });
      if (res.error) setError(res.error);
      else {
        setFeel(f);
        setEditing(false);
      }
    });
  }

  if (!editing && feel) {
    const f = ARM_FEELS.find((x) => x.key === feel)!;
    return (
      <section
        aria-label="Arm check-in"
        className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200"
      >
        <span aria-hidden className="text-2xl">
          {FACE[feel]}
        </span>
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">Arm today: {f.label}.</span>{" "}
          {feel === "pain"
            ? "Tell your coach before you throw today."
            : feel === "sore"
              ? "Your coach can see this. Take it easy."
              : "Thanks, your coach can see it."}
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-h-11 text-sm font-semibold text-brand-700"
        >
          Change
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="arm-q" className="rounded-2xl bg-surface p-4 ring-1 ring-zinc-200">
      <h2 id="arm-q" className="font-semibold">
        How&apos;s your arm today?
      </h2>
      <p className="text-sm text-zinc-600">
        One tap. Your coach sees it on the team&apos;s health board.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ARM_FEELS.map((f) => (
          <button
            key={f.key}
            type="button"
            disabled={pending}
            onClick={() => pick(f.key)}
            className={cn(
              "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-sm font-semibold ring-1 ring-zinc-200 transition-transform active:scale-95 disabled:opacity-60",
              feel === f.key ? f.className : "bg-surface hover:bg-zinc-50",
            )}
          >
            <span aria-hidden className="text-xl">
              {FACE[f.key]}
            </span>
            {f.label}
          </button>
        ))}
      </div>
      {pending ? <p className="mt-2 text-sm text-zinc-500">Saving…</p> : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
