"use client";

import { useState, useTransition } from "react";
import {
  linkRegistrationPlayer,
  setRegistrationOpen,
  withdrawRegistration,
} from "@/lib/registration-actions";
import { selectClass } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function CopyLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/join/${token}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-zinc-100 px-3 py-2.5 text-sm">
        {path}
      </code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(`${location.origin}${path}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="h-11 shrink-0 rounded-full bg-zinc-900 px-4 text-sm font-semibold text-zinc-50"
      >
        {copied ? "✓ Copied" : "Copy link"}
      </button>
    </div>
  );
}

export function OpenToggle({ formId, open }: { formId: string; open: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await setRegistrationOpen(formId, !open);
            setError(res.error ?? "");
          })
        }
        className={cn(
          "h-11 rounded-full px-4 text-sm font-semibold ring-1 disabled:opacity-60",
          open ? "text-zinc-800 ring-zinc-300" : "bg-brand-700 text-on-brand ring-brand-700",
        )}
      >
        {pending ? "Saving…" : open ? "Close registration" : "Reopen registration"}
      </button>
      {error ? <span className="text-sm text-red-700">{error}</span> : null}
    </span>
  );
}

export function RegistrationActions({
  regId,
  linked,
  players,
}: {
  regId: string;
  linked: boolean;
  players: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  const [player, setPlayer] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!linked && players.length ? (
        <>
          <select
            aria-label="Link to a player on the roster"
            value={player}
            onChange={(e) => setPlayer(e.target.value)}
            className={cn(selectClass, "w-auto")}
          >
            <option value="">Link to roster player…</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!player || pending}
            onClick={() =>
              start(async () => {
                const res = await linkRegistrationPlayer(regId, player);
                setError(res.error ?? "");
              })
            }
            className="h-11 rounded-full px-4 text-sm font-semibold ring-1 ring-zinc-300 disabled:opacity-50"
          >
            Link
          </button>
        </>
      ) : null}
      {confirm ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await withdrawRegistration(regId);
              setError(res.error ?? "");
            })
          }
          className="h-11 rounded-full bg-red-700 px-4 text-sm font-semibold text-on-brand"
        >
          Confirm withdraw
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="h-11 rounded-full px-3 text-sm font-medium text-zinc-600 hover:text-red-700"
        >
          Withdraw
        </button>
      )}
      {error ? <span className="text-sm text-red-700">{error}</span> : null}
    </div>
  );
}
