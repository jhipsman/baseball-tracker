"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { respondToActivity } from "@/lib/team-schedule-actions";
import type { ActivityKind } from "@/lib/team-schedule";
export type AttendancePlayer = { id: string; name: string; response: string; checkedIn: boolean };
export function Attendance({
  kind,
  activityId,
  players,
  staff,
  closed,
}: {
  kind: ActivityKind;
  activityId: string;
  players: AttendancePlayer[];
  staff: boolean;
  closed: boolean;
}) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  function save(id: string, response?: string, checkIn?: boolean) {
    start(async () => {
      setError("");
      try {
        const result = await respondToActivity({
          kind,
          activityId,
          playerId: id,
          response,
          checkIn,
        });
        if (result.error) setError(result.error);
        else setMessage(checkIn === undefined ? "RSVP saved." : "Check-in updated.");
      } catch {
        setError("The response did not save. Check your connection and try again.");
      }
    });
  }
  return (
    <section className="space-y-4 rounded-xl bg-surface p-5 ring-1 ring-zinc-200">
      <h2 className="font-semibold">{staff ? "RSVPs & check-in" : "Your RSVP"}</h2>
      {staff && (
        <p className="text-sm text-zinc-600">
          {players.filter((p) => p.response === "yes").length} going ·{" "}
          {players.filter((p) => p.response === "maybe").length} maybe ·{" "}
          {players.filter((p) => p.response === "no").length} not going ·{" "}
          {players.filter((p) => p.response === "unanswered").length} unanswered ·{" "}
          {players.filter((p) => p.checkedIn).length} checked in
        </p>
      )}
      {closed && (
        <p className="text-sm text-amber-800">
          This activity is canceled or not open for responses.
        </p>
      )}
      {players.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center gap-3 border-t border-zinc-200 py-3">
          <span className="min-w-32 flex-1 text-sm font-medium">{p.name}</span>
          <label className="text-sm">
            <span className="sr-only">RSVP for {p.name}</span>
            <select
              className="h-11 rounded-lg bg-surface px-3 ring-1 ring-zinc-300"
              value={p.response}
              disabled={pending || closed}
              onChange={(e) => save(p.id, e.target.value)}
            >
              {[
                ["unanswered", "No response"],
                ["yes", "Going"],
                ["maybe", "Maybe"],
                ["no", "Not going"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {staff && (
            <Button
              variant="secondary"
              disabled={pending || closed}
              onClick={() => save(p.id, undefined, !p.checkedIn)}
            >
              {p.checkedIn ? "✓ Checked in" : "Check in"}
            </Button>
          )}
        </div>
      ))}
      {!players.length && (
        <p className="text-sm text-zinc-600">
          No eligible players are linked to your account for this activity.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      )}
      <p role="status" className="text-sm text-brand-700">
        {pending ? "Saving…" : message}
      </p>
    </section>
  );
}
