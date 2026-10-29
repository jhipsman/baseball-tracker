"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FormState } from "@/lib/auth/actions";
import {
  createGame,
  createGamesBulk,
  createTournament,
  deleteGame,
  deleteTournament,
  duplicateGame,
  rescheduleGame,
  setGameStatus,
  updateGame,
  updateTournament,
  type QuickRow,
} from "@/lib/game-actions";
import { parseTime } from "@/lib/practices";
import { GAME_KINDS, HOME_AWAY, type GameKind, type GameStatus, type HomeAway } from "@/lib/games";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { selectClass, SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormAction } from "@/components/ui/use-form-action";
import { cn } from "@/lib/utils";

export type Option = { id: string; name: string };

export type GameDefaults = {
  opponent?: string | null;
  date?: string | null;
  startTime?: string | null;
  arrivalTime?: string | null;
  homeAway?: HomeAway | null;
  kind?: GameKind | null;
  groupId?: string | null;
  tournamentId?: string | null;
  location?: string | null;
  address?: string | null;
  notes?: string | null;
  inningsScheduled?: number | null;
};

const textareaClass =
  "block w-full rounded-lg border-0 bg-white px-3 py-2 text-base text-zinc-900 ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm";

const t5 = (t: string | null | undefined) => t?.slice(0, 5) ?? "";

/** All the inputs for one game. */
export function GameFields({
  defaults,
  groups,
  tournaments,
  idPrefix = "",
}: {
  defaults: GameDefaults;
  groups: Option[];
  tournaments: Option[];
  idPrefix?: string;
}) {
  const id = (k: string) => `${idPrefix}${k}`;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field
        label="Opponent"
        id={id("opponent")}
        name="opponent"
        required
        maxLength={120}
        defaultValue={defaults.opponent ?? ""}
        placeholder="e.g. Riverside Tigers"
        className="sm:col-span-2"
      />
      <Field
        label="Date"
        id={id("date")}
        name="date"
        type="date"
        required
        defaultValue={defaults.date ?? ""}
      />
      <SelectField
        label="Home / away"
        id={id("home_away")}
        name="home_away"
        defaultValue={defaults.homeAway ?? "home"}
      >
        {HOME_AWAY.map((h) => (
          <option key={h.key} value={h.key}>
            {h.label}
          </option>
        ))}
      </SelectField>
      <Field
        label="Start time"
        id={id("start_time")}
        name="start_time"
        type="time"
        defaultValue={t5(defaults.startTime)}
      />
      <Field
        label="Arrive by"
        id={id("arrival_time")}
        name="arrival_time"
        type="time"
        defaultValue={t5(defaults.arrivalTime)}
      />
      <SelectField
        label="Type"
        id={id("kind")}
        name="kind"
        defaultValue={defaults.kind ?? "league"}
      >
        {GAME_KINDS.map((k) => (
          <option key={k.key} value={k.key}>
            {k.label}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Who"
        id={id("group_id")}
        name="group_id"
        defaultValue={defaults.groupId ?? ""}
      >
        <option value="">Whole team</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name} only
          </option>
        ))}
      </SelectField>
      <Field
        label="Location"
        id={id("location")}
        name="location"
        maxLength={200}
        defaultValue={defaults.location ?? ""}
        placeholder="e.g. Memorial Park, Field 2"
      />
      <Field
        label="Address"
        id={id("address")}
        name="address"
        maxLength={300}
        defaultValue={defaults.address ?? ""}
        placeholder="For the Directions link"
      />
      {tournaments.length > 0 ? (
        <SelectField
          label="Tournament"
          id={id("tournament_id")}
          name="tournament_id"
          defaultValue={defaults.tournamentId ?? ""}
        >
          <option value="">None</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectField>
      ) : null}
      <Field
        label="Innings"
        id={id("innings_scheduled")}
        name="innings_scheduled"
        type="number"
        min={1}
        max={12}
        defaultValue={defaults.inningsScheduled ?? 7}
      />
      <label className="block space-y-1.5 sm:col-span-2">
        <span className="block text-sm font-medium text-zinc-800">Notes</span>
        <textarea
          name="notes"
          rows={3}
          maxLength={4000}
          defaultValue={defaults.notes ?? ""}
          placeholder="Uniform, dugout, umpire fees, what to bring…"
          className={textareaClass}
        />
      </label>
    </div>
  );
}

export function NewGameForm({
  defaults,
  groups,
  tournaments,
  returnTo,
  idPrefix,
  submitLabel = "Add game",
}: {
  defaults: GameDefaults;
  groups: Option[];
  tournaments: Option[];
  returnTo?: string;
  idPrefix?: string;
  submitLabel?: string;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(createGame, {});
  const v = state.values;
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
      <GameFields
        key={v ? JSON.stringify(v) : "init"}
        idPrefix={idPrefix}
        groups={groups}
        tournaments={tournaments}
        defaults={
          v
            ? {
                opponent: v.opponent,
                date: v.date,
                startTime: v.start_time,
                arrivalTime: v.arrival_time,
                homeAway: v.home_away as HomeAway,
                kind: v.kind as GameKind,
                groupId: v.group_id,
                tournamentId: v.tournament_id,
                location: v.location,
                address: v.address,
                notes: v.notes,
                inningsScheduled: Number(v.innings_scheduled) || 7,
              }
            : defaults
        }
      />
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel="Adding…">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

export function EditGameForm({
  id,
  defaults,
  groups,
  tournaments,
}: {
  id: string;
  defaults: GameDefaults;
  groups: Option[];
  tournaments: Option[];
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(updateGame, {});
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {/* Re-mount the inputs when the saved game changes (e.g. after Reschedule). */}
      <GameFields
        key={JSON.stringify(defaults)}
        defaults={defaults}
        groups={groups}
        tournaments={tournaments}
        idPrefix="edit-"
      />
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel="Saving…" variant="secondary">
        Save game
      </SubmitButton>
    </form>
  );
}

// ----------------------------------------------------------------- quick entry

const blankRow = (homeAway: HomeAway = "home"): QuickRow => ({
  date: "",
  startTime: "",
  opponent: "",
  homeAway,
  location: "",
});

const filledLabel = (n: number) => (n ? `Add ${n} game${n === 1 ? "" : "s"}` : "Add games");

/** Several games at once: one row per game. */
export function QuickEntryForm({
  groups,
  tournaments,
  defaultTournamentId,
  defaultKind = "league",
  doneHref,
}: {
  groups: Option[];
  tournaments: Option[];
  defaultTournamentId?: string;
  defaultKind?: GameKind;
  doneHref: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<QuickRow[]>(() => Array.from({ length: 5 }, () => blankRow()));
  const [kind, setKind] = useState<GameKind>(defaultKind);
  const [groupId, setGroupId] = useState("");
  const [tournamentId, setTournamentId] = useState(defaultTournamentId ?? "");
  const [arrive, setArrive] = useState("45");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const update = (i: number, patch: Partial<QuickRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () =>
    setRows((rs) => {
      const last = rs.at(-1);
      // Carry the last row's time forward: season games usually share a start time.
      return [...rs, { ...blankRow(), startTime: last?.startTime ?? "" }];
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await createGamesBulk({
        rows,
        kind,
        groupId: groupId || null,
        tournamentId: tournamentId || null,
        arriveMinutes: arrive === "" ? null : Number(arrive),
      });
      if (r.error) {
        setError(r.error);
        return;
      }
      router.push(`${doneHref}${doneHref.includes("?") ? "&" : "?"}added=${r.count ?? 0}`);
    });
  };

  const cellInput =
    "block h-10 w-full rounded-md border-0 bg-white px-2 text-base ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-brand-600 sm:text-sm";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 rounded-xl bg-zinc-50 p-3 sm:grid-cols-4">
        <SelectField
          label="Type"
          name="q_kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as GameKind)}
        >
          {GAME_KINDS.map((k) => (
            <option key={k.key} value={k.key}>
              {k.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Who"
          name="q_group"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
        >
          <option value="">Whole team</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} only
            </option>
          ))}
        </SelectField>
        {tournaments.length > 0 ? (
          <SelectField
            label="Tournament"
            name="q_tournament"
            value={tournamentId}
            onChange={(e) => setTournamentId(e.target.value)}
          >
            <option value="">None</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </SelectField>
        ) : null}
        <Field
          label="Arrive (min early)"
          name="q_arrive"
          type="number"
          min={0}
          max={240}
          value={arrive}
          onChange={(e) => setArrive(e.target.value)}
        />
      </div>

      <div className="hidden grid-cols-[2rem_9.5rem_7.5rem_minmax(0,1fr)_7rem_minmax(0,1fr)_2rem] gap-2 text-xs font-medium text-zinc-500 sm:grid">
        <span />
        <span>Date</span>
        <span>Start</span>
        <span>Opponent</span>
        <span>Home / away</span>
        <span>Location</span>
        <span />
      </div>
      <ol className="space-y-3 sm:space-y-2">
        {rows.map((r, i) => (
          <li
            key={i}
            data-testid="quick-row"
            className="grid grid-cols-2 gap-2 rounded-xl bg-white p-3 ring-1 ring-zinc-200 sm:grid-cols-[2rem_9.5rem_7.5rem_minmax(0,1fr)_7rem_minmax(0,1fr)_2rem] sm:items-center sm:rounded-none sm:p-0 sm:ring-0"
          >
            <span className="col-span-2 text-xs font-semibold text-zinc-500 sm:col-span-1 sm:text-center">
              {i + 1}
            </span>
            <label className="sr-only" htmlFor={`q-date-${i}`}>
              Date for game {i + 1}
            </label>
            <input
              id={`q-date-${i}`}
              type="date"
              value={r.date}
              onChange={(e) => update(i, { date: e.target.value })}
              className={cellInput}
            />
            <label className="sr-only" htmlFor={`q-time-${i}`}>
              Start time for game {i + 1}
            </label>
            <input
              id={`q-time-${i}`}
              type="time"
              value={r.startTime}
              onChange={(e) => update(i, { startTime: e.target.value })}
              className={cellInput}
            />
            <label className="sr-only" htmlFor={`q-opp-${i}`}>
              Opponent for game {i + 1}
            </label>
            <input
              id={`q-opp-${i}`}
              placeholder="Opponent"
              maxLength={120}
              value={r.opponent}
              onChange={(e) => update(i, { opponent: e.target.value })}
              className={cn(cellInput, "col-span-2 sm:col-span-1")}
            />
            <label className="sr-only" htmlFor={`q-ha-${i}`}>
              Home or away for game {i + 1}
            </label>
            <select
              id={`q-ha-${i}`}
              value={r.homeAway}
              onChange={(e) => update(i, { homeAway: e.target.value as HomeAway })}
              className={cn(selectClass, "h-10 w-full")}
            >
              {HOME_AWAY.map((h) => (
                <option key={h.key} value={h.key}>
                  {h.label}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor={`q-loc-${i}`}>
              Location for game {i + 1}
            </label>
            <input
              id={`q-loc-${i}`}
              placeholder="Location"
              maxLength={200}
              value={r.location}
              onChange={(e) => update(i, { location: e.target.value })}
              className={cellInput}
            />
            <button
              type="button"
              aria-label={`Remove game ${i + 1}`}
              onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs))}
              className="h-10 rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            >
              ✕
            </button>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={addRow}>
          + Add row
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : filledLabel(rows.filter((r) => r.opponent.trim()).length)}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}

// ----------------------------------------------------------------- status

/** Postpone / cancel / restore buttons plus the reschedule form. */
export function StatusControls({
  id,
  status,
  defaults,
}: {
  id: string;
  status: GameStatus;
  defaults: GameDefaults;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [showMove, setShowMove] = useState(status === "postponed");
  const set = (next: "scheduled" | "postponed" | "canceled", confirmText: string) => {
    if (!confirm(confirmText)) return;
    setError(null);
    start(async () => {
      const r = await setGameStatus(id, next);
      if (r.error) setError(r.error);
    });
  };
  const live = status === "live" || status === "final";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === "scheduled" ? (
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                set("postponed", "Postpone this game? Players and parents will be notified.")
              }
            >
              Postpone
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              className="text-red-700"
              onClick={() =>
                set("canceled", "Cancel this game? Players and parents will be notified.")
              }
            >
              Cancel game
            </Button>
          </>
        ) : null}
        {status === "postponed" || status === "canceled" ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => set("scheduled", "Put this game back on the schedule (same date)?")}
          >
            Back on schedule
          </Button>
        ) : null}
        {live ? null : (
          <Button type="button" variant="secondary" onClick={() => setShowMove((s) => !s)}>
            Reschedule
          </Button>
        )}
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {showMove && !live ? <RescheduleForm id={id} defaults={defaults} /> : null}
    </div>
  );
}

function RescheduleForm({ id, defaults }: { id: string; defaults: GameDefaults }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(rescheduleGame, {});
  const [start, setStart] = useState(t5(defaults.startTime));
  const [arrival, setArrival] = useState(t5(defaults.arrivalTime));
  // Moving the start time moves the arrival time with it (same lead time).
  const changeStart = (next: string) => {
    const a = parseTime(arrival);
    const before = parseTime(start);
    const after = parseTime(next);
    if (a != null && before != null && after != null) {
      const m = Math.max(0, after - (before - a));
      setArrival(
        `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
      );
    }
    setStart(next);
  };
  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl bg-zinc-50 p-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label="New date"
          id="move-date"
          name="date"
          type="date"
          required
          defaultValue={defaults.date ?? ""}
        />
        <Field
          label="Start time"
          id="move-start"
          name="start_time"
          type="time"
          value={start}
          onChange={(e) => changeStart(e.target.value)}
        />
        <Field
          label="Arrive by"
          id="move-arrival"
          name="arrival_time"
          type="time"
          value={arrival}
          onChange={(e) => setArrival(e.target.value)}
        />
        <Field
          label="Location"
          id="move-location"
          name="location"
          maxLength={200}
          defaultValue={defaults.location ?? ""}
          className="sm:col-span-2"
        />
        <Field
          label="Address"
          id="move-address"
          name="address"
          maxLength={300}
          defaultValue={defaults.address ?? ""}
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel="Saving…">
        Save new time &amp; notify
      </SubmitButton>
    </form>
  );
}

export function DuplicateGameForm({ id, defaultDate }: { id: string; defaultDate: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(duplicateGame, {});
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <div className="flex items-end gap-2">
        <Field
          label="Duplicate to date"
          id="dup-date"
          name="date"
          type="date"
          required
          defaultValue={defaultDate}
        />
        <SubmitButton pending={pending} pendingLabel="Copying…" variant="secondary">
          Duplicate
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function DeleteGameButton({ id }: { id: string }) {
  return (
    <form
      action={deleteGame}
      onSubmit={(e) => {
        if (!confirm("Delete this game and its score? This can't be undone.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton pendingLabel="Deleting…" variant="ghost" className="w-full text-red-700">
        Delete game
      </SubmitButton>
    </form>
  );
}

// ----------------------------------------------------------------- tournaments

export type TournamentDefaults = {
  name?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  location?: string | null;
  address?: string | null;
  url?: string | null;
  notes?: string | null;
  groupId?: string | null;
};

function TournamentFields({
  defaults,
  groups,
}: {
  defaults: TournamentDefaults;
  groups: Option[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field
        label="Name"
        id="t-name"
        name="name"
        required
        maxLength={120}
        defaultValue={defaults.name ?? ""}
        placeholder="e.g. Fall Classic 12U"
        className="sm:col-span-2"
      />
      <Field
        label="Starts"
        id="t-start"
        name="start_date"
        type="date"
        required
        defaultValue={defaults.startDate ?? ""}
      />
      <Field
        label="Ends"
        id="t-end"
        name="end_date"
        type="date"
        required
        defaultValue={defaults.endDate ?? ""}
      />
      <Field
        label="Location"
        id="t-location"
        name="location"
        maxLength={200}
        defaultValue={defaults.location ?? ""}
      />
      <Field
        label="Address"
        id="t-address"
        name="address"
        maxLength={300}
        defaultValue={defaults.address ?? ""}
      />
      <Field
        label="Bracket link"
        id="t-url"
        name="url"
        type="url"
        maxLength={500}
        defaultValue={defaults.url ?? ""}
        placeholder="https://…"
      />
      <SelectField label="Who" id="t-group" name="group_id" defaultValue={defaults.groupId ?? ""}>
        <option value="">Whole team</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name} only
          </option>
        ))}
      </SelectField>
      <label className="block space-y-1.5 sm:col-span-2">
        <span className="block text-sm font-medium text-zinc-800">Notes</span>
        <textarea
          name="notes"
          rows={3}
          maxLength={4000}
          defaultValue={defaults.notes ?? ""}
          placeholder="Hotel, gate fees, pool play format…"
          className={textareaClass}
        />
      </label>
    </div>
  );
}

export function NewTournamentForm({ groups, today }: { groups: Option[]; today: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(createTournament, {});
  const v = state.values;
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <TournamentFields
        key={v ? JSON.stringify(v) : "init"}
        groups={groups}
        defaults={
          v
            ? {
                name: v.name,
                startDate: v.start_date,
                endDate: v.end_date,
                location: v.location,
                address: v.address,
                url: v.url,
                notes: v.notes,
                groupId: v.group_id,
              }
            : { startDate: today, endDate: today }
        }
      />
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel="Creating…">
        Create tournament
      </SubmitButton>
    </form>
  );
}

export function EditTournamentForm({
  id,
  defaults,
  groups,
}: {
  id: string;
  defaults: TournamentDefaults;
  groups: Option[];
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(updateTournament, {});
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <TournamentFields defaults={defaults} groups={groups} />
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel="Saving…" variant="secondary">
        Save tournament
      </SubmitButton>
    </form>
  );
}

export function DeleteTournamentButton({ id }: { id: string }) {
  return (
    <form
      action={deleteTournament}
      onSubmit={(e) => {
        if (!confirm("Delete this tournament? Its games stay on the schedule.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton pendingLabel="Deleting…" variant="ghost" className="text-red-700">
        Delete tournament
      </SubmitButton>
    </form>
  );
}
