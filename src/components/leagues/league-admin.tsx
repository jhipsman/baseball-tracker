"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormAction } from "@/components/ui/use-form-action";
import {
  addDivision,
  addLeagueGame,
  addLeagueTeam,
  createLeagueTeam,
  deleteDivision,
  deleteLeague,
  deleteLeagueGame,
  findTeamPages,
  importLeagueGames,
  removeLeagueTeam,
  saveLeagueGame,
  setLeagueTeamDivision,
  type LeagueGameInput,
} from "@/lib/league-admin-actions";
import { LEVELS, clock } from "@/lib/leagues";
import { nameMatches, type ResolvedGame } from "@/lib/league-standings";
import { parseCsv } from "@/lib/imports/parse";
import { findHeader, icsToGrid, matchFields, parseDate, parseTime } from "@/lib/imports/smart";
import { day } from "@/lib/staff-pay";
import type { LeagueDivisionRow, LeagueRow } from "@/types/team-operations";
import { cn } from "@/lib/utils";

type R = { error?: string; ok?: string };
type Team = { id: string; name: string };

async function safe<T extends R>(fn: () => Promise<T>): Promise<T | R> {
  try {
    return await fn();
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { error: "That didn't go through. Check your connection and try again." };
  }
}

function Note({ r }: { r: R }) {
  if (!r.error && !r.ok) return null;
  return (
    <p
      role={r.error ? "alert" : "status"}
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        r.error ? "bg-red-50 text-red-700" : "bg-brand-50 text-brand-900",
      )}
    >
      {r.error ?? r.ok}
    </p>
  );
}

/** Run an action, show its result, refresh the page on success. */
function useRun() {
  const router = useRouter();
  const [r, setR] = useState<R>({});
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<R>, after?: () => void) =>
    start(async () => {
      const res = await safe(fn);
      setR(res);
      if (!res.error) {
        after?.();
        router.refresh();
      }
    });
  return { r, setR, pending, run };
}

const inputCls =
  "h-11 min-w-0 rounded-lg bg-surface px-3 text-base text-zinc-900 ring-1 ring-zinc-300 ring-inset sm:text-sm";

export function LeagueForm({
  action,
  league,
  submitLabel,
}: {
  action: (prev: R, fd: FormData) => Promise<R>;
  league?: LeagueRow;
  submitLabel: string;
}) {
  const { state, onSubmit, pending } = useFormAction<R>((p, fd) => safe(() => action(p, fd)), {});
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {league ? <input type="hidden" name="id" value={league.id} /> : null}
      <Field
        label="League name"
        name="name"
        required
        maxLength={80}
        defaultValue={league?.name}
        placeholder="North County Youth Baseball"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Season (optional)"
          name="season"
          maxLength={40}
          defaultValue={league?.season ?? ""}
          placeholder="Spring 2027"
        />
        <SelectField label="Level" name="level" defaultValue={league?.level ?? "travel"}>
          {LEVELS.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
        </SelectField>
        <Field label="City" name="city" maxLength={60} defaultValue={league?.city ?? ""} />
        <Field label="State" name="state" maxLength={30} defaultValue={league?.state ?? ""} />
      </div>
      <Note r={state} />
      <SubmitButton pending={pending} pendingLabel="Saving…">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

export function DivisionsEditor({
  leagueId,
  divisions,
}: {
  leagueId: string;
  divisions: LeagueDivisionRow[];
}) {
  const [name, setName] = useState("");
  const { r, pending, run } = useRun();
  return (
    <div className="space-y-3">
      {divisions.length ? (
        <ul className="flex flex-wrap gap-2">
          {divisions.map((d) => (
            <li
              key={d.id}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-100 py-1 pr-1 pl-3 text-sm font-medium"
            >
              {d.name}
              <button
                type="button"
                aria-label={`Remove ${d.name}`}
                disabled={pending}
                onClick={() => {
                  if (confirm(`Remove the ${d.name} division? Its teams stay in the league.`))
                    run(() => deleteDivision(leagueId, d.id));
                }}
                className="grid size-7 place-items-center rounded-full text-zinc-500 hover:bg-zinc-200"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-600">
          No divisions. Standings show one table for the whole league.
        </p>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => addDivision(leagueId, name),
            () => setName(""),
          );
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="New division"
          placeholder="North, 12U, American…"
          maxLength={60}
          className={cn(inputCls, "flex-1")}
        />
        <Button type="submit" variant="secondary" disabled={pending || !name.trim()}>
          Add
        </Button>
      </form>
      <Note r={r} />
    </div>
  );
}

function DivisionSelect({
  divisions,
  value,
  onChange,
  label = "Division",
}: {
  divisions: LeagueDivisionRow[];
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  if (!divisions.length) return null;
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(inputCls, "h-10")}
    >
      <option value="">No division</option>
      {divisions.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  );
}

export function TeamsEditor({
  leagueId,
  divisions,
  teams,
}: {
  leagueId: string;
  divisions: LeagueDivisionRow[];
  teams: (Team & { divisionId: string | null; slug: string })[];
}) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Awaited<ReturnType<typeof findTeamPages>> | null>(null);
  const [division, setDivision] = useState("");
  const { r, setR, pending, run } = useRun();
  const [searching, startSearch] = useTransition();
  const inLeague = new Set(teams.map((t) => t.id));
  return (
    <div className="space-y-4">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          setR({});
          startSearch(async () => setFound(await findTeamPages(q)));
        }}
      >
        <label htmlFor="team-q" className="block text-sm font-medium text-zinc-800">
          Add a team
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="team-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Team name"
            className={cn(inputCls, "flex-1")}
          />
          <DivisionSelect divisions={divisions} value={division} onChange={setDivision} />
          <Button type="submit" variant="secondary" disabled={searching || q.trim().length < 2}>
            {searching ? "Looking…" : "Find"}
          </Button>
        </div>
      </form>
      {found ? (
        <div className="space-y-2 rounded-xl bg-zinc-50 p-3">
          {found.length ? (
            <ul className="divide-y divide-zinc-200">
              {found.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 text-sm">
                    <b className="block truncate">
                      {t.name}
                      {t.verified ? <span className="ml-1 text-brand-700">✓</span> : null}
                    </b>
                    <span className="text-zinc-500">
                      {[t.age_group, [t.city, t.state].filter(Boolean).join(", ")]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {inLeague.has(t.id) ? (
                    <span className="text-sm text-zinc-500">In the league</span>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-9 px-4"
                      disabled={pending}
                      onClick={() => run(() => addLeagueTeam(leagueId, t.id, division || null))}
                    >
                      Add
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-600">No team page called “{q}” yet.</p>
          )}
          <Button
            type="button"
            variant="ghost"
            className="h-9 px-3"
            disabled={pending || q.trim().length < 2}
            onClick={() =>
              run(
                () => createLeagueTeam(leagueId, q, division || null),
                () => {
                  setQ("");
                  setFound(null);
                },
              )
            }
          >
            + Create “{q.trim()}” as a new team
          </Button>
        </div>
      ) : null}
      <Note r={r} />
      {teams.length ? (
        <ul className="divide-y divide-zinc-200 rounded-2xl ring-1 ring-zinc-200">
          {teams.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <a href={`/leagues/t/${t.slug}`} className="min-w-0 flex-1 truncate font-medium">
                {t.name}
              </a>
              <DivisionSelect
                divisions={divisions}
                value={t.divisionId ?? ""}
                label={`Division for ${t.name}`}
                onChange={(v) => run(() => setLeagueTeamDivision(leagueId, t.id, v || null))}
              />
              <button
                type="button"
                className="h-10 px-2 text-sm font-semibold text-red-700"
                disabled={pending}
                onClick={() => {
                  if (confirm(`Take ${t.name} out of the league? Its league games are removed.`))
                    run(() => removeLeagueTeam(leagueId, t.id));
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-600">No teams yet.</p>
      )}
    </div>
  );
}

export function AddLeagueGame({
  leagueId,
  teams,
  today,
}: {
  leagueId: string;
  teams: Team[];
  today: string;
}) {
  const blank = { date: today, time: "", home: "", away: "", location: "" };
  const [g, setG] = useState(blank);
  const { r, pending, run } = useRun();
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) =>
    setG({ ...g, [k]: e.target.value });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => addLeagueGame(leagueId, g),
          () => setG({ ...blank, date: g.date }),
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Date"
          name="lg-date"
          type="date"
          required
          value={g.date}
          onChange={set("date")}
        />
        <Field
          label="Start time (optional)"
          name="lg-time"
          type="time"
          value={g.time}
          onChange={set("time")}
        />
        <SelectField label="Away team" name="lg-away" value={g.away} onChange={set("away")}>
          <option value="">Choose…</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Home team" name="lg-home" value={g.home} onChange={set("home")}>
          <option value="">Choose…</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectField>
      </div>
      <Field
        label="Field (optional)"
        name="lg-location"
        maxLength={120}
        value={g.location}
        onChange={set("location")}
      />
      <Note r={r} />
      <Button type="submit" disabled={pending || teams.length < 2}>
        {pending ? "Adding…" : "Add game"}
      </Button>
    </form>
  );
}

/** A league schedule from a file or pasted cells, with Home and Away team columns. */
export function LeagueScheduleImport({ leagueId, teams }: { leagueId: string; teams: Team[] }) {
  const [grid, setGrid] = useState<{ rows: string[][]; name: string } | null>(null);
  const [paste, setPaste] = useState("");
  const { r, setR, pending, run } = useRun();

  async function readFile(file: File) {
    setR({});
    if (file.size > 5_000_000) return setR({ error: "Choose a file under 5 MB." });
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const { default: read } = await import("read-excel-file/browser");
        const book = await read(file);
        const sheet = [...book].sort((a, b) => b.data.length - a.data.length)[0];
        setGrid({
          rows: (sheet?.data ?? []).map((row) =>
            row.map((v) => (v instanceof Date ? v.toISOString() : v == null ? "" : String(v))),
          ),
          name: file.name,
        });
      } else {
        const text = await file.text();
        setGrid({
          rows: text.includes("BEGIN:VCALENDAR") ? icsToGrid(text) : parseCsv(text),
          name: file.name,
        });
      }
    } catch {
      setR({ error: "We couldn't read that file." });
    }
  }

  const parsed = useMemo(() => {
    if (!grid?.rows.length) return null;
    const header = findHeader(grid.rows);
    const map = matchFields(header.headers, "schedule");
    const cell = (row: string[], k: string) =>
      map[k] >= 0 ? String(row[map[k]] ?? "").trim() : "";
    const match = (name: string) =>
      teams.find((t) => t.name.toLowerCase() === name.toLowerCase()) ??
      teams.find((t) => nameMatches(name, t.name));
    const games: (LeagueGameInput & { homeName: string; awayName: string })[] = [];
    const unknown = new Set<string>();
    let unreadable = 0;
    for (const row of grid.rows.slice(header.row + 1)) {
      if (!row.some((c) => String(c).trim())) continue;
      const rawDate = cell(row, "date");
      const date = parseDate(rawDate);
      const homeName = cell(row, "home_team");
      const awayName = cell(row, "away_team");
      if (!date || !homeName || !awayName) {
        unreadable++;
        continue;
      }
      const home = match(homeName);
      const away = match(awayName);
      if (!home) unknown.add(homeName);
      if (!away) unknown.add(awayName);
      if (!home || !away || home.id === away.id) continue;
      const time = parseTime(cell(row, "time") || (/\d:\d|[ap]m/i.test(rawDate) ? rawDate : ""));
      games.push({
        date,
        time: time || null,
        home: home.id,
        away: away.id,
        location: cell(row, "location") || null,
        homeName: home.name,
        awayName: away.name,
      });
    }
    return {
      games,
      unknown: [...unknown],
      unreadable,
      hasTeams: map.home_team >= 0 && map.away_team >= 0,
    };
  }, [grid, teams]);

  if (grid && parsed)
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-700">
          From <b>{grid.name}</b>: <b>{parsed.games.length}</b> game
          {parsed.games.length === 1 ? "" : "s"}
          {parsed.unreadable ? ` · ${parsed.unreadable} rows without a date or both teams` : ""}
        </p>
        {!parsed.hasTeams ? (
          <p className="text-sm text-amber-900">
            We need a Home team column and an Away team column.
          </p>
        ) : null}
        {parsed.unknown.length ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Not in the league yet, so their games are left out: {parsed.unknown.join(", ")}. Add
            them under Teams, then read the file again.
          </p>
        ) : null}
        {parsed.games.length ? (
          <ul className="max-h-72 divide-y divide-zinc-200 overflow-y-auto rounded-xl ring-1 ring-zinc-200">
            {parsed.games.map((g, i) => (
              <li key={i} className="flex justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  {g.awayName} @ {g.homeName}
                </span>
                <span className="shrink-0 text-zinc-600 tabular-nums">
                  {day(g.date)}
                  {g.time ? ` · ${clock(g.time)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <Note r={r} />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={pending || !parsed.games.length}
            onClick={() =>
              run(
                () =>
                  importLeagueGames(
                    leagueId,
                    parsed.games.map(({ date, time, home, away, location }) => ({
                      date,
                      time,
                      home,
                      away,
                      location,
                    })),
                  ),
                () => setGrid(null),
              )
            }
          >
            {pending ? "Adding…" : `Add ${parsed.games.length} games`}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setGrid(null)}>
            Start over
          </Button>
        </div>
      </div>
    );

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-zinc-300 px-4 py-5 text-center hover:bg-zinc-50">
        <span className="font-semibold text-brand-700">Choose a league schedule file</span>
        <span className="text-xs text-zinc-500">
          CSV or Excel with Date, Time, Home team, Away team and Field columns
        </span>
        <input
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,.ics"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void readFile(f);
            e.target.value = "";
          }}
        />
      </label>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-brand-700">
          Or paste from a spreadsheet
        </summary>
        <div className="mt-2 space-y-2">
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={5}
            aria-label="Pasted league schedule"
            placeholder={"Date\tTime\tHome team\tAway team\tField"}
            className="block w-full rounded-lg bg-surface px-3 py-2 font-mono text-sm text-zinc-900 ring-1 ring-zinc-300 ring-inset"
          />
          <Button
            type="button"
            variant="secondary"
            disabled={!paste.trim()}
            onClick={() => setGrid({ rows: parseCsv(paste), name: "Pasted cells" })}
          >
            Read schedule
          </Button>
        </div>
      </details>
      <Note r={r} />
    </div>
  );
}

/** The league admin's score box for one game, with what the teams reported. */
export function LeagueGameEditor({
  leagueId,
  g,
  names,
}: {
  leagueId: string;
  g: ResolvedGame;
  names: Record<string, string>;
}) {
  const set = g.status === "final";
  const [h, setH] = useState(set ? String(g.home_score ?? "") : "");
  const [a, setA] = useState(set ? String(g.away_score ?? "") : "");
  const { r, pending, run } = useRun();
  const num = (s: string) => (/^\d{1,2}$/.test(s.trim()) ? Number(s) : null);
  const home = names[g.home_team_id] ?? "Home";
  const away = names[g.away_team_id] ?? "Away";
  const hint =
    g.shown === "disputed" && g.reported
      ? `Teams disagree. ${home} says ${away} ${g.reported.home[1]}, ${home} ${g.reported.home[0]}. ${away} says ${away} ${g.reported.away[1]}, ${home} ${g.reported.away[0]}. Enter the right score.`
      : g.source && g.source !== "league" && g.shown === "final"
        ? `Reported by ${g.source === "both" ? "both teams" : g.source === "home" ? home : away}: ${g.away}–${g.home}`
        : g.status !== "scheduled"
          ? "Set by you. Clear it to use the teams' scores again."
          : null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-1.5">
          <span className="max-w-28 truncate">{away}</span>
          <input
            value={a}
            onChange={(e) => setA(e.target.value)}
            inputMode="numeric"
            aria-label={`${away} runs`}
            className="h-10 w-14 rounded-lg bg-surface px-2 text-center text-zinc-900 ring-1 ring-zinc-300 ring-inset"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="max-w-28 truncate">@ {home}</span>
          <input
            value={h}
            onChange={(e) => setH(e.target.value)}
            inputMode="numeric"
            aria-label={`${home} runs`}
            className="h-10 w-14 rounded-lg bg-surface px-2 text-center text-zinc-900 ring-1 ring-zinc-300 ring-inset"
          />
        </label>
        <Button
          type="button"
          variant="secondary"
          className="h-10 px-4"
          disabled={pending}
          onClick={() =>
            run(() =>
              saveLeagueGame({ id: g.id, leagueId, status: "final", home: num(h), away: num(a) }),
            )
          }
        >
          Save final
        </Button>
        <select
          aria-label="More"
          value=""
          disabled={pending}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "delete") {
              if (confirm("Delete this game from the league schedule?"))
                run(() => deleteLeagueGame(leagueId, g.id));
            } else if (v)
              run(
                () => saveLeagueGame({ id: g.id, leagueId, status: v as "scheduled" }),
                () => {
                  setH("");
                  setA("");
                },
              );
          }}
          className={cn(inputCls, "h-10")}
        >
          <option value="">More…</option>
          {g.status !== "scheduled" ? (
            <option value="scheduled">Use the teams&apos; scores</option>
          ) : null}
          {g.status !== "postponed" ? <option value="postponed">Postponed</option> : null}
          {g.status !== "canceled" ? <option value="canceled">Canceled</option> : null}
          <option value="delete">Delete game</option>
        </select>
      </div>
      {hint ? (
        <p
          className={cn(
            "text-xs",
            g.shown === "disputed" ? "font-semibold text-amber-900" : "text-zinc-500",
          )}
        >
          {hint}
        </p>
      ) : null}
      {r.error ? <Note r={r} /> : null}
    </div>
  );
}

export function DeleteLeagueButton({ id, name }: { id: string; name: string }) {
  const { r, pending, run } = useRun();
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-red-700 hover:underline"
        disabled={pending}
        onClick={() => {
          if (confirm(`Delete ${name}? Its schedule and standings go with it. Team pages stay.`))
            run(() => deleteLeague(id));
        }}
      >
        {pending ? "Deleting…" : "Delete this league"}
      </button>
      <Note r={r} />
    </div>
  );
}

/** For a team's owner: take the team out of a league. */
export function LeaveLeagueButton({
  leagueId,
  teamId,
  leagueName,
}: {
  leagueId: string;
  teamId: string;
  leagueName: string;
}) {
  const { r, pending, run } = useRun();
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        className="text-sm font-semibold text-red-700 hover:underline"
        disabled={pending}
        onClick={() => {
          if (confirm(`Take your team out of ${leagueName}?`))
            run(() => removeLeagueTeam(leagueId, teamId));
        }}
      >
        Leave
      </button>
      {r.error ? <Note r={r} /> : null}
    </span>
  );
}
