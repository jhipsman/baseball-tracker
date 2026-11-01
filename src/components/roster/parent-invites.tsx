"use client";

import { useState, useTransition } from "react";
import { inviteParents } from "@/app/(dashboard)/roster/actions";

/** Every player still without a parent, one email box each, sent in one tap. */
export function ParentInvites({ players }: { players: { id: string; name: string }[] }) {
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ error?: string; sent?: number; notes?: string[] }>();
  const [pending, start] = useTransition();
  const filled = Object.values(emails).filter((e) => e.trim()).length;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await inviteParents(
            players.map((p) => ({ playerId: p.id, email: emails[p.id] ?? "" })),
          );
          setResult(r);
          if (!r.error) setEmails({});
        });
      }}
      className="space-y-3"
    >
      <ul className="divide-y divide-zinc-100">
        {players.map((p) => (
          <li key={p.id} className="grid gap-1 py-2 sm:grid-cols-[12rem_1fr] sm:items-center">
            <label htmlFor={`parent-${p.id}`} className="truncate text-sm font-medium">
              {p.name}
            </label>
            <input
              id={`parent-${p.id}`}
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="Parent's email"
              value={emails[p.id] ?? ""}
              onChange={(e) => setEmails((m) => ({ ...m, [p.id]: e.target.value }))}
              className="h-11 w-full rounded-lg bg-surface px-3 text-base ring-1 ring-zinc-300 sm:text-sm"
            />
          </li>
        ))}
      </ul>
      <p className="text-xs text-zinc-500">
        Brothers or sisters with the same parent? Use the same email; they get one invite for all of
        them.
      </p>
      <button
        type="submit"
        disabled={pending || filled === 0}
        className="inline-flex h-11 items-center rounded-full bg-brand-600 px-6 text-sm font-semibold text-on-brand hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "Sending…" : filled > 1 ? `Send ${filled} invites` : "Send invite"}
      </button>
      {result?.error ? (
        <p role="alert" className="text-sm text-red-700">
          {result.error}
        </p>
      ) : null}
      {result?.sent ? (
        <p role="status" className="text-sm text-brand-800">
          Sent {result.sent} invite{result.sent === 1 ? "" : "s"}. Parents get an email with a link
          to join; you&apos;ll see them under Pending invitations until they do.
        </p>
      ) : null}
      {result?.notes?.length ? (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-amber-800">
          {result.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
