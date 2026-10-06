"use client";

import { useState, useTransition } from "react";
import {
  ARM_FEELS,
  INTENSITIES,
  PITCH_TYPES,
  THROW_TYPES,
  type ArmFeelValue,
  type ThrowingIntensity,
  type ThrowingType,
} from "@/constants/throwing";
import { logThrowing } from "@/lib/throwing-actions";
import { cn } from "@/lib/utils";

const chip = (on: boolean) =>
  cn(
    "min-h-11 rounded-lg px-3 py-2 text-sm font-medium ring-1 ring-inset",
    on ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white text-zinc-700 ring-zinc-300",
  );

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Log a throwing session or arm check-in. With `players`, a coach picks who
 * it's for (e.g. entering game pitch counts); otherwise it logs for yourself.
 */
export function ThrowLogForm({
  players,
  defaultType = "long_toss",
  compact = false,
}: {
  players?: { id: string; name: string }[];
  defaultType?: ThrowingType;
  compact?: boolean;
}) {
  const [type, setType] = useState<ThrowingType>(defaultType);
  const [playerId, setPlayerId] = useState(players?.[0]?.id ?? "");
  const [date, setDate] = useState(localDate);
  const [pitches, setPitches] = useState("");
  const [distance, setDistance] = useState("");
  const [intensity, setIntensity] = useState<ThrowingIntensity | null>(null);
  const [armFeel, setArmFeel] = useState<ArmFeelValue | null>(null);
  const [mix, setMix] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const checkIn = type === "check_in";
  const showMix = type === "bullpen" || type === "live_abs" || type === "game";
  const mixTotal = Object.values(mix).reduce((n, v) => n + (Number(v) || 0), 0);
  const visibleTypes = players ? THROW_TYPES.filter((t) => t.key !== "check_in") : THROW_TYPES;

  const bump = (delta: number) =>
    setPitches((p) => String(Math.max(0, Math.min(400, (Number(p) || 0) + delta))));

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const res = await logThrowing({
        playerId: players ? playerId : undefined,
        date,
        type,
        pitches: Number(pitches || (showMix ? mixTotal : 0)),
        maxDistance: distance ? Number(distance) : null,
        intensity,
        armFeel,
        pitchesByType: showMix
          ? Object.fromEntries(Object.entries(mix).map(([k, v]) => [k, Number(v) || 0]))
          : null,
        notes,
      });
      if (res.error) {
        setMessage({ ok: false, text: res.error });
        return;
      }
      setMessage({ ok: true, text: checkIn ? "Arm check-in saved." : "Session logged." });
      setPitches("");
      setDistance("");
      setMix({});
      setNotes("");
      setArmFeel(null);
      setIntensity(null);
    });
  }

  return (
    <div className="space-y-4">
      {players ? (
        <label className="block text-sm font-medium text-zinc-800">
          Player
          <select
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            className="mt-1 block h-11 w-full rounded-lg border-0 bg-white px-3 ring-1 ring-inset ring-zinc-300"
          >
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <fieldset>
        <legend className="text-sm font-medium text-zinc-800">What did you do?</legend>
        <div
          className={cn("mt-2 grid gap-2", compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3")}
        >
          {visibleTypes.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={type === t.key}
              onClick={() => setType(t.key)}
              className={chip(type === t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {THROW_TYPES.find((t) => t.key === type)?.hint}
        </p>
      </fieldset>

      <label className="block text-sm font-medium text-zinc-800">
        Date
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 block h-11 rounded-lg border-0 bg-white px-3 ring-1 ring-inset ring-zinc-300"
        />
      </label>

      {checkIn ? null : (
        <>
          <div>
            <label htmlFor="pitches" className="text-sm font-medium text-zinc-800">
              {type === "long_toss" || type === "flat_ground" ? "Total throws" : "Pitch count"}
            </label>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => bump(-5)}
                className="h-12 w-14 rounded-lg bg-zinc-100 text-lg font-semibold ring-1 ring-inset ring-zinc-200"
                aria-label="Minus 5"
              >
                −5
              </button>
              <input
                id="pitches"
                inputMode="numeric"
                value={pitches}
                placeholder={showMix && mixTotal ? String(mixTotal) : "0"}
                onChange={(e) => setPitches(e.target.value.replace(/\D/g, "").slice(0, 3))}
                className="h-12 w-24 rounded-lg border-0 bg-white text-center text-xl font-semibold tabular-nums ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-brand-600"
              />
              <button
                type="button"
                onClick={() => bump(5)}
                className="h-12 w-14 rounded-lg bg-zinc-100 text-lg font-semibold ring-1 ring-inset ring-zinc-200"
                aria-label="Plus 5"
              >
                +5
              </button>
            </div>
          </div>

          {type === "long_toss" ? (
            <label className="block text-sm font-medium text-zinc-800">
              Max distance (ft)
              <input
                inputMode="numeric"
                value={distance}
                onChange={(e) => setDistance(e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="e.g. 180"
                className="mt-1 block h-11 w-32 rounded-lg border-0 bg-white px-3 tabular-nums ring-1 ring-inset ring-zinc-300"
              />
            </label>
          ) : null}

          {showMix ? (
            <fieldset>
              <legend className="text-sm font-medium text-zinc-800">
                Pitch mix <span className="font-normal text-zinc-500">(optional)</span>
              </legend>
              <div className="mt-1 grid grid-cols-5 gap-2">
                {PITCH_TYPES.map((p) => (
                  <label key={p.key} className="text-center text-xs text-zinc-600">
                    {p.label}
                    <input
                      inputMode="numeric"
                      aria-label={`${p.label} count`}
                      value={mix[p.key] ?? ""}
                      onChange={(e) =>
                        setMix((m) => ({
                          ...m,
                          [p.key]: e.target.value.replace(/\D/g, "").slice(0, 3),
                        }))
                      }
                      className="mt-0.5 block h-11 w-full rounded-lg border-0 bg-white text-center tabular-nums ring-1 ring-inset ring-zinc-300"
                    />
                  </label>
                ))}
              </div>
              {mixTotal > 0 && pitches && Number(pitches) !== mixTotal ? (
                <p className="mt-1 text-xs text-amber-700">
                  Pitch mix adds up to {mixTotal}, but the count is {pitches}.
                </p>
              ) : null}
            </fieldset>
          ) : null}

          <fieldset>
            <legend className="text-sm font-medium text-zinc-800">Intensity</legend>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {INTENSITIES.map((i) => (
                <button
                  key={i.key}
                  type="button"
                  aria-pressed={intensity === i.key}
                  onClick={() => setIntensity(intensity === i.key ? null : i.key)}
                  className={chip(intensity === i.key)}
                >
                  {i.label}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}

      <fieldset>
        <legend className="text-sm font-medium text-zinc-800">
          How does the arm feel?{" "}
          {checkIn ? null : <span className="font-normal text-zinc-500">(optional)</span>}
        </legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {ARM_FEELS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={armFeel === f.key}
              onClick={() => setArmFeel(armFeel === f.key ? null : f.key)}
              className={cn(
                "min-h-11 rounded-lg px-3 py-2 text-sm font-semibold ring-1 ring-inset",
                armFeel === f.key
                  ? cn(f.className, "ring-transparent")
                  : "bg-white text-zinc-700 ring-zinc-300",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {armFeel === "pain" ? (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            Your coach will be alerted. Stop throwing and talk to your coach or athletic trainer
            before your next session.
          </p>
        ) : null}
      </fieldset>

      <label className="block text-sm font-medium text-zinc-800">
        Notes
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 block w-full rounded-lg border-0 px-3 py-2 text-base ring-1 ring-inset ring-zinc-300"
        />
      </label>

      {message ? (
        <p
          role={message.ok ? "status" : "alert"}
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            message.ok ? "bg-brand-50 text-brand-900" : "bg-red-50 text-red-700",
          )}
        >
          {message.text}
        </p>
      ) : null}

      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="h-12 w-full rounded-xl bg-brand-700 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : checkIn ? "Save check-in" : "Log session"}
      </button>
    </div>
  );
}
