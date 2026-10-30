"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setHealthStatus, togglePlanStep } from "@/lib/health-actions";
import { RETURN_TO_THROW, type HealthState, type HealthStatus } from "@/lib/health";
import { cn } from "@/lib/utils";

const OPTIONS: { key: HealthState; label: string; hint: string; on: string }[] = [
  { key: "full", label: "✓ Full go", hint: "No limits", on: "bg-brand-50 ring-brand-600" },
  {
    key: "limited",
    label: "◐ Limited",
    hint: "Plays with limits",
    on: "bg-orange-50 ring-orange-900",
  },
  { key: "out", label: "⛔ Out", hint: "Not playing", on: "bg-red-50 ring-red-700" },
];

/** The coach's call on a player, with the reason, expected return and a return-to-throw plan. */
export function StatusEditor({ playerId, current }: { playerId: string; current: HealthStatus }) {
  const [status, setStatus] = useState<HealthState>(current.status);
  const [reason, setReason] = useState(current.reason ?? "");
  const [returnDate, setReturnDate] = useState(current.returnDate ?? "");
  const [usePlan, setUsePlan] = useState(current.plan.length > 0 || current.status === "full");
  const [planText, setPlanText] = useState(
    (current.plan.length ? current.plan.map((s) => s.label) : RETURN_TO_THROW).join("\n"),
  );
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const changed =
    status !== current.status ||
    (status !== "full" &&
      (reason !== (current.reason ?? "") ||
        returnDate !== (current.returnDate ?? "") ||
        usePlan !== current.plan.length > 0 ||
        (usePlan && planText !== current.plan.map((s) => s.label).join("\n"))));

  function save() {
    setMessage(null);
    const old = new Map(current.plan.map((s) => [s.label, s.done]));
    const plan = usePlan
      ? planText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map((label) => ({ label, done: old.get(label) ?? false }))
      : [];
    start(async () => {
      const res = await setHealthStatus(playerId, { status, reason, returnDate, plan });
      setMessage(res.error ? { ok: false, text: res.error } : { ok: true, text: "Saved." });
    });
  }

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Can they play?</legend>
        <div className="grid grid-cols-3 gap-2">
          {OPTIONS.map((o) => (
            <label
              key={o.key}
              className={cn(
                "flex min-h-14 cursor-pointer flex-col justify-center rounded-xl px-3 py-2 ring-1",
                status === o.key ? cn("ring-2", o.on) : "bg-surface ring-zinc-200 hover:bg-zinc-50",
              )}
            >
              <input
                type="radio"
                name="health-status"
                value={o.key}
                checked={status === o.key}
                onChange={() => setStatus(o.key)}
                className="sr-only"
              />
              <span className="text-sm font-semibold">{o.label}</span>
              <span className="text-xs text-zinc-600">{o.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {status !== "full" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
            <label className="text-sm font-medium">
              What&apos;s going on?
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
                placeholder="e.g. Sore elbow, no throwing"
                className="mt-1 block h-11 w-full rounded-lg bg-surface px-3 ring-1 ring-zinc-300"
              />
            </label>
            <label className="text-sm font-medium">
              Expected back
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="mt-1 block h-11 w-full rounded-lg bg-surface px-3 ring-1 ring-zinc-300"
              />
            </label>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={usePlan}
              onChange={(e) => setUsePlan(e.target.checked)}
              className="size-5 accent-brand-700"
            />
            Follow a return-to-throw plan
          </label>
          {usePlan ? (
            <label className="block text-sm font-medium">
              Steps, one per line
              <textarea
                value={planText}
                onChange={(e) => setPlanText(e.target.value)}
                rows={Math.min(12, planText.split("\n").length + 1)}
                className="mt-1 block w-full rounded-lg bg-surface px-3 py-2 text-sm ring-1 ring-zinc-300"
              />
              <span className="mt-1 block text-xs font-normal text-zinc-500">
                A common starting point. Adjust it with your trainer or doctor; this is a checklist,
                not medical advice.
              </span>
            </label>
          ) : null}
        </>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending || !changed}
          onClick={save}
          className="h-11 rounded-full bg-brand-700 px-5 text-sm font-semibold text-on-brand disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
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
    </div>
  );
}

/** Tick off return-to-throw steps as the player gets through them. */
export function PlanChecklist({
  playerId,
  plan,
}: {
  playerId: string;
  plan: HealthStatus["plan"];
}) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  // Tick immediately; the server catches up (and rolls back on error).
  const [steps, flip] = useOptimistic(plan, (cur, i: number) =>
    cur.map((s, j) => (j === i ? { ...s, done: !s.done } : s)),
  );
  const done = steps.filter((s) => s.done).length;
  return (
    <div className="space-y-2">
      <p className="text-sm text-zinc-600">
        {done} of {steps.length} steps done
      </p>
      <ol className="space-y-1">
        {steps.map((s, i) => (
          <li key={i}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-zinc-50">
              <input
                type="checkbox"
                checked={s.done}
                disabled={pending}
                onChange={() => {
                  setBusy(i);
                  start(async () => {
                    flip(i);
                    const res = await togglePlanStep(playerId, i);
                    setError(res.error ?? "");
                    setBusy(null);
                  });
                }}
                className="size-5 accent-brand-700"
              />
              <span className="w-5 text-sm font-semibold text-zinc-500">{i + 1}</span>
              <span className={cn("text-sm", s.done && "text-zinc-500 line-through")}>
                {s.label}
              </span>
              {busy === i ? <span className="text-xs text-zinc-500">Saving…</span> : null}
            </label>
          </li>
        ))}
      </ol>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
