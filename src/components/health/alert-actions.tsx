"use client";

import { useState, useTransition } from "react";
import { markAlertHandled, reopenAlert } from "@/lib/health-actions";
import { cn } from "@/lib/utils";

/** "Mark handled" on an alert; it leaves the Today board but stays on the player's page. */
export function HandleAlert({
  playerId,
  alertKey,
  handled = false,
  className,
}: {
  playerId: string;
  alertKey: string;
  handled?: boolean;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError("");
            const res = handled
              ? await reopenAlert(playerId, alertKey)
              : await markAlertHandled(playerId, alertKey);
            if (res.error) setError(res.error);
          })
        }
        className={cn(
          "min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold ring-1 disabled:opacity-60",
          handled
            ? "text-zinc-600 ring-zinc-300 hover:bg-zinc-50"
            : "bg-surface text-zinc-900 ring-zinc-300 hover:bg-zinc-50",
        )}
      >
        {pending ? "Saving…" : handled ? "Reopen" : "✓ Mark handled"}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </span>
  );
}
