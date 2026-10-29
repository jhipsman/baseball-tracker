"use client";

import { useMemo, useState } from "react";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { useFormAction } from "@/components/ui/use-form-action";
import { startThread, type MessageFormState } from "@/lib/message-actions";
import { cn } from "@/lib/utils";
import { textareaClass } from "./styles";

export type Recipient = {
  id: string;
  name: string;
  label: string;
  kind: "player" | "parent" | "staff";
};

const SECTIONS = [
  { kind: "player", title: "Players" },
  { kind: "parent", title: "Parents" },
  { kind: "staff", title: "Coaches & staff" },
] as const;

export function NewThreadForm({
  recipients,
  groups = [],
  defaultSelected = [],
  staffView,
  parentView = false,
}: {
  recipients: Recipient[];
  groups?: { id: string; name: string; memberIds: string[] }[];
  defaultSelected?: string[];
  /** Coaches pick anyone; players and parents pick among staff. */
  staffView: boolean;
  /** Parents get their own note: their messages don't copy their player. */
  parentView?: boolean;
}) {
  const { state, onSubmit, pending } = useFormAction<MessageFormState>(startThread, {});
  const [selected, setSelected] = useState(() => new Set(defaultSelected));
  const [query, setQuery] = useState("");

  const toggle = (id: string, on?: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on ?? !next.has(id)) next.add(id);
      else next.delete(id);
      return next;
    });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? recipients.filter((r) => `${r.name} ${r.label}`.toLowerCase().includes(q))
      : recipients;
  }, [query, recipients]);

  const playerIds = new Set(recipients.filter((r) => r.kind === "player").map((r) => r.id));

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-zinc-800">
          {staffView ? "To" : "Which coach?"}
          {selected.size ? (
            <span className="ml-2 font-normal text-zinc-500">{selected.size} selected</span>
          ) : null}
        </legend>

        {staffView && groups.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500">Quick pick:</span>
            {groups.map((g) => {
              const ids = g.memberIds.filter((id) => playerIds.has(id));
              const all = ids.length > 0 && ids.every((id) => selected.has(id));
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={!ids.length}
                  onClick={() => ids.forEach((id) => toggle(id, !all))}
                  aria-pressed={all}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold ring-1 disabled:opacity-40",
                    all
                      ? "bg-brand-700 text-white ring-brand-700"
                      : "bg-white text-zinc-700 ring-zinc-300",
                  )}
                >
                  {g.name} ({ids.length})
                </button>
              );
            })}
          </div>
        ) : null}

        {staffView && recipients.length > 8 ? (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people"
            aria-label="Search people"
            className="block h-10 w-full rounded-lg border-0 bg-white px-3 text-base ring-1 ring-zinc-300 ring-inset focus:ring-2 focus:ring-brand-600 sm:text-sm"
          />
        ) : null}

        {recipients.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {staffView ? "No one else is on the team yet." : "Your team has no coaches yet."}
          </p>
        ) : null}

        {SECTIONS.map((s) => {
          const people = visible.filter((r) => r.kind === s.kind);
          if (!people.length) return null;
          return (
            <div key={s.kind}>
              {staffView ? (
                <p className="mb-1 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
                  {s.title}
                </p>
              ) : null}
              <ul className="max-h-72 divide-y divide-zinc-100 overflow-y-auto rounded-xl bg-white ring-1 ring-zinc-200">
                {people.map((r) => (
                  <li key={r.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-zinc-50">
                      <input
                        type="checkbox"
                        name="member"
                        value={r.id}
                        checked={selected.has(r.id)}
                        onChange={(e) => toggle(r.id, e.target.checked)}
                        className="size-4 shrink-0 accent-brand-700"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-zinc-900">
                          {r.name}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">{r.label}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {/* Keep selections hidden by the search box in the submission. */}
        {[...selected]
          .filter((id) => !visible.some((r) => r.id === id))
          .map((id) => (
            <input key={id} type="hidden" name="member" value={id} />
          ))}
      </fieldset>

      <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-900">
        {staffView
          ? "Parents are automatically copied on messages with their player, and every conversation includes a coach."
          : parentView
            ? "Only the coaches you pick see this message. Your player isn't added to it."
            : "Messages always go to a coach. Linked parents are copied on conversations with their player."}
      </p>

      <Field label="Subject (optional)" name="subject" maxLength={140} />
      <div className="space-y-1.5">
        <label htmlFor="new-thread-body" className="block text-sm font-medium text-zinc-800">
          Message
        </label>
        <textarea
          id="new-thread-body"
          name="body"
          required
          maxLength={4000}
          rows={5}
          className={textareaClass}
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel="Sending…" className="w-full sm:w-auto">
        Send message
      </SubmitButton>
    </form>
  );
}
