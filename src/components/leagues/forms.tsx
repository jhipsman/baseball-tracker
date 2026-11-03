"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormAction } from "@/components/ui/use-form-action";
import { addGame, deleteGame, deleteTeam, saveGame } from "@/lib/league-actions";
import { LEVELS } from "@/lib/leagues";
import type { PublicTeamRow } from "@/types/team-operations";

type R = { error?: string; ok?: string };

async function safe(fn: () => Promise<R>): Promise<R> {
  try {
    return await fn();
  } catch (e) {
    // redirect() inside an action surfaces as a thrown navigation; let it through.
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { error: "That didn't go through. Check your connection and try again." };
  }
}

export function Msg({ r }: { r: R }) {
  if (r.error)
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {r.error}
      </p>
    );
  if (r.ok)
    return (
      <p role="status" className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
        {r.ok}
      </p>
    );
  return null;
}

/** Create or edit a team page. */
export function TeamForm({
  action,
  team,
  links,
  submitLabel,
}: {
  action: (prev: R, fd: FormData) => Promise<R>;
  team?: PublicTeamRow;
  links: { value: string; label: string }[];
  submitLabel: string;
}) {
  const { state, onSubmit, pending } = useFormAction<R>(
    (prev, fd) => safe(() => action(prev, fd)),
    {},
  );
  const current = team?.org_id
    ? `org:${team.org_id}${team.group_id ? `:${team.group_id}` : ""}`
    : "";
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {team ? <input type="hidden" name="id" value={team.id} /> : null}
      <Field
        label="Team name"
        name="name"
        required
        maxLength={80}
        defaultValue={team?.name}
        placeholder="Riverside Rays 14U"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Level" name="level" defaultValue={team?.level ?? "travel"}>
          {LEVELS.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
        </SelectField>
        <Field
          label="Age group (optional)"
          name="age_group"
          maxLength={20}
          defaultValue={team?.age_group ?? ""}
          placeholder="14U, Varsity, 18+"
        />
        <Field
          label="City"
          name="city"
          maxLength={60}
          defaultValue={team?.city ?? ""}
          placeholder="Austin"
        />
        <Field
          label="State"
          name="state"
          maxLength={30}
          defaultValue={team?.state ?? ""}
          placeholder="TX"
        />
      </div>
      {links.length || current ? (
        <SelectField
          label="Results from 9D"
          name="link"
          defaultValue={current}
          className="max-w-full"
        >
          <option value="">No, I&apos;ll enter games here</option>
          {links.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </SelectField>
      ) : null}
      {links.length ? (
        <p className="-mt-2 text-sm text-zinc-600">
          Link a team you run on 9D and its schedule and scores show here automatically. Nothing
          about players is shown.
        </p>
      ) : null}
      <Msg r={state} />
      <SubmitButton pending={pending} pendingLabel="Saving…">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

export function AddGameForm({ teamId, today }: { teamId: string; today: string }) {
  const form = useRef<HTMLFormElement>(null);
  const { state, onSubmit, pending } = useFormAction<R>(async (_prev, fd) => {
    const r = await safe(() => addGame({}, fd));
    if (!r.error) form.current?.reset();
    return r;
  }, {});
  return (
    <form ref={form} onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="team_id" value={teamId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date" name="date" type="date" required defaultValue={today} />
        <Field label="Start time (optional)" name="start_time" type="time" />
        <Field label="Opponent" name="opponent" required maxLength={80} placeholder="Eagles" />
        <SelectField label="Home or away" name="home_away" defaultValue="home">
          <option value="home">Home</option>
          <option value="away">Away</option>
          <option value="neutral">Neutral site</option>
        </SelectField>
      </div>
      <Field
        label="Field (optional)"
        name="location"
        maxLength={120}
        placeholder="Memorial Park, Field 2"
      />
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium text-zinc-800">
          Final score (leave empty if it hasn&apos;t been played)
        </legend>
        <div className="flex items-center gap-2">
          <input
            name="team_score"
            inputMode="numeric"
            aria-label="Our score"
            placeholder="Us"
            className="h-11 w-20 rounded-lg bg-surface px-3 text-center text-zinc-900 ring-1 ring-zinc-300 ring-inset"
          />
          <span aria-hidden className="text-zinc-500">
            –
          </span>
          <input
            name="opponent_score"
            inputMode="numeric"
            aria-label="Their score"
            placeholder="Them"
            className="h-11 w-20 rounded-lg bg-surface px-3 text-center text-zinc-900 ring-1 ring-zinc-300 ring-inset"
          />
        </div>
      </fieldset>
      <Msg r={state} />
      <SubmitButton pending={pending} pendingLabel="Adding…">
        Add game
      </SubmitButton>
    </form>
  );
}

/** Score entry for one game on the manage page. */
export function GameEditor({
  id,
  status,
  us,
  them,
}: {
  id: string;
  status: string;
  us: number | null;
  them: number | null;
}) {
  const [a, setA] = useState(us?.toString() ?? "");
  const [b, setB] = useState(them?.toString() ?? "");
  const [r, setR] = useState<R>({});
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<R>) => start(async () => setR(await safe(fn)));
  const num = (s: string) => (/^\d{1,2}$/.test(s.trim()) ? Number(s) : null);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={a}
          onChange={(e) => setA(e.target.value)}
          inputMode="numeric"
          aria-label="Our score"
          placeholder="Us"
          className="h-10 w-16 rounded-lg bg-surface px-2 text-center text-zinc-900 ring-1 ring-zinc-300 ring-inset"
        />
        <span aria-hidden className="text-zinc-500">
          –
        </span>
        <input
          value={b}
          onChange={(e) => setB(e.target.value)}
          inputMode="numeric"
          aria-label="Their score"
          placeholder="Them"
          className="h-10 w-16 rounded-lg bg-surface px-2 text-center text-zinc-900 ring-1 ring-zinc-300 ring-inset"
        />
        <Button
          type="button"
          variant="secondary"
          className="h-10 px-4"
          disabled={pending}
          onClick={() => run(() => saveGame({ id, status: "final", us: num(a), them: num(b) }))}
        >
          {status === "final" ? "Update" : "Save final"}
        </Button>
        <select
          aria-label="More"
          value=""
          disabled={pending}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "delete") {
              if (confirm("Delete this game?")) run(() => deleteGame(id));
            } else if (v) run(() => saveGame({ id, status: v as "scheduled" }));
          }}
          className="h-10 rounded-lg bg-surface px-2 text-sm text-zinc-900 ring-1 ring-zinc-300 ring-inset"
        >
          <option value="">More…</option>
          {status !== "scheduled" ? <option value="scheduled">Not played yet</option> : null}
          {status !== "postponed" ? <option value="postponed">Postponed</option> : null}
          {status !== "canceled" ? <option value="canceled">Canceled</option> : null}
          <option value="delete">Delete game</option>
        </select>
      </div>
      {r.error ? <Msg r={r} /> : null}
    </div>
  );
}

export function DeleteTeamButton({ id, name }: { id: string; name: string }) {
  const [r, setR] = useState<R>({});
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-red-700 hover:underline disabled:opacity-60"
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete the public page for ${name}? Its games go with it.`))
            start(async () => setR(await safe(() => deleteTeam(id))));
        }}
      >
        {pending ? "Deleting…" : "Delete this page"}
      </button>
      <Msg r={r} />
    </div>
  );
}
