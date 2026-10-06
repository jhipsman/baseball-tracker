"use client";

import { useActionState, useState } from "react";
import { cn } from "@/lib/utils";
import type { FormState } from "@/lib/auth/actions";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormAction } from "@/components/ui/use-form-action";
import { assignProgram, updateProgram } from "../actions";
import { ProgramFields, type ProgramDefaults } from "../program-fields";

export function EditProgramForm({ id, defaults }: { id: string; defaults: ProgramDefaults }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(updateProgram, {});
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <ProgramFields defaults={defaults} />
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel="Saving…">
        Save details
      </SubmitButton>
    </form>
  );
}

type AssignPlayer = {
  id: string;
  name: string;
  detail: string;
  position: string | null;
  assigned: boolean;
};

export function AssignForm({
  programId,
  players,
  groups,
  today,
}: {
  programId: string;
  players: AssignPlayer[];
  groups: { id: string; name: string; memberIds: string[] }[];
  today: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(assignProgram, {});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (players.length === 0) {
    return (
      <p className="text-sm text-zinc-600">
        No players on the roster yet. Invite players from the Roster page first.
      </p>
    );
  }

  const available = players.filter((p) => !p.assigned);
  // Players assigned since they were ticked drop out of the selection.
  const selectedCount = available.filter((p) => selected.has(p.id)).length;
  const positions = [...new Set(players.map((p) => p.position).filter(Boolean))] as string[];

  /** Select (or, if all already selected, deselect) the assignable players in a set. */
  const toggleSet = (ids: string[]) => {
    const target = ids.filter((id) => available.some((p) => p.id === id));
    if (target.length === 0) return;
    setSelected((cur) => {
      const next = new Set(cur);
      const allOn = target.every((id) => next.has(id));
      for (const id of target) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };
  const chip = (key: string, label: string, ids: string[]) => {
    const target = ids.filter((id) => available.some((p) => p.id === id));
    const on = target.length > 0 && target.every((id) => selected.has(id));
    return (
      <button
        key={key}
        type="button"
        disabled={target.length === 0}
        aria-pressed={on}
        onClick={() => toggleSet(ids)}
        className={cn(
          "rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset disabled:opacity-40",
          on ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-zinc-700 ring-zinc-300",
        )}
      >
        {label}
        <span className="ml-1 opacity-70">{target.length}</span>
      </button>
    );
  };

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="program_id" value={programId} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Quick select
        </span>
        {chip(
          "all",
          "All players",
          players.map((p) => p.id),
        )}
        {groups.map((g) => chip(`g-${g.id}`, g.name, g.memberIds))}
        {positions.map((pos) =>
          chip(
            `p-${pos}`,
            pos,
            players.filter((p) => p.position === pos).map((p) => p.id),
          ),
        )}
      </div>
      <fieldset>
        <legend className="sr-only">Players</legend>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {players.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 ring-1 ring-inset ring-zinc-200 has-checked:bg-brand-50 has-checked:ring-brand-600">
                <input
                  type="checkbox"
                  name="player_id"
                  value={p.id}
                  disabled={p.assigned}
                  checked={!p.assigned && selected.has(p.id)}
                  onChange={() =>
                    setSelected((cur) => {
                      const next = new Set(cur);
                      if (next.has(p.id)) next.delete(p.id);
                      else next.add(p.id);
                      return next;
                    })
                  }
                  className="size-4 accent-brand-700"
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {p.name}
                  <span className="ml-1 text-zinc-500">{p.detail}</span>
                </span>
                {p.assigned ? <span className="text-xs text-zinc-500">Assigned</span> : null}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-zinc-800">
          Start date
          <input
            type="date"
            name="start_date"
            defaultValue={today}
            required
            className="mt-1 block h-11 rounded-lg border-0 bg-white px-3 ring-1 ring-inset ring-zinc-300"
          />
        </label>
        <SubmitButton pendingLabel="Assigning…" disabled={selectedCount === 0}>
          Assign{selectedCount > 0 ? ` to ${selectedCount}` : ""}
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
