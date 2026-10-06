"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/auth/actions";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { assignProgram, updateProgram } from "../actions";
import { ProgramFields, type ProgramDefaults } from "../program-fields";

export function EditProgramForm({ id, defaults }: { id: string; defaults: ProgramDefaults }) {
  const [state, action] = useActionState<FormState, FormData>(updateProgram, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <ProgramFields defaults={defaults} />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Saving…">Save details</SubmitButton>
    </form>
  );
}

export function AssignForm({
  programId,
  players,
  today,
}: {
  programId: string;
  players: { id: string; name: string; detail: string; assigned: boolean }[];
  today: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(assignProgram, {});

  if (players.length === 0) {
    return (
      <p className="text-sm text-zinc-600">
        No players on the roster yet. Invite players from the Roster page first.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="program_id" value={programId} />
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
        <SubmitButton pendingLabel="Assigning…">Assign</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
