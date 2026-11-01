"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { parseCsv, type ImportKind } from "@/lib/imports/parse";
import {
  buildRoster,
  buildSchedule,
  buildStats,
  detectKind,
  detectPlatform,
  fieldsFor,
  findHeader,
  icsToGrid,
  matchFields,
  teamNames,
  type Platform,
} from "@/lib/imports/smart";
import { GUIDES, PLATFORMS } from "@/constants/import-guides";
import { cn } from "@/lib/utils";
import { fetchCalendar, importRoster, importSchedule, importStats, undoImport } from "./actions";

const KIND_LABEL: Record<ImportKind, string> = {
  roster: "Roster",
  schedule: "Schedule",
  stats: "Past stats",
};
const input = "h-11 rounded-lg bg-surface px-3 text-sm ring-1 ring-zinc-300";
const primary =
  "inline-flex h-12 items-center justify-center rounded-full bg-brand-700 px-6 text-sm font-semibold text-on-brand disabled:opacity-50";
const secondary =
  "inline-flex h-11 items-center justify-center rounded-full bg-surface px-5 text-sm font-semibold ring-1 ring-zinc-300 hover:bg-zinc-50 disabled:opacity-50";

type Loaded = { grid: string[][]; name: string; sheets?: string[][][]; sheetNames?: string[] };
type Done = { kind: ImportKind; batch?: string; summary: Record<string, number>; undone?: boolean };

/** Bring a team over: pick where you're coming from, drop the export, check, import. */
export function SwitchWizard({ teamName, groups }: { teamName: string; groups: string[] }) {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [sheet, setSheet] = useState(0);
  const [kind, setKind] = useState<ImportKind>("roster");
  const [map, setMap] = useState<Record<string, number>>({});
  const [ourTeam, setOurTeam] = useState("");
  const [invite, setInvite] = useState(true);
  const [season, setSeason] = useState(`${new Date().getFullYear()} season`);
  const [category, setCategory] = useState<"batting" | "pitching">("batting");
  const [paste, setPaste] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const [done, setDone] = useState<Done | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const grid = useMemo(
    () => (loaded?.sheets ? (loaded.sheets[sheet] ?? []) : (loaded?.grid ?? [])),
    [loaded, sheet],
  );
  const header = useMemo(() => (grid.length ? findHeader(grid) : { row: 0, headers: [] }), [grid]);

  function accept(next: Loaded, pick = 0) {
    const g = next.sheets ? next.sheets[pick] : next.grid;
    const cleaned = g.filter((r) => r.some((c) => String(c).trim()));
    if (cleaned.length < 2)
      throw new Error("That file looks empty: we need a heading row and at least one row.");
    const h = findHeader(cleaned);
    const k = detectKind(h.headers);
    const m = matchFields(h.headers, k);
    setLoaded(
      next.sheets
        ? { ...next, sheets: next.sheets.map((s, i) => (i === pick ? cleaned : s)) }
        : { ...next, grid: cleaned },
    );
    setSheet(pick);
    setKind(k);
    setMap(m);
    setPlatform((p) => detectPlatform(next.name, h.headers) ?? p);
    const names = teamNames(cleaned, h.row, m);
    setOurTeam(
      names.find((n) => [teamName, ...groups].some((t) => t.toLowerCase() === n.toLowerCase())) ??
        "",
    );
    setError("");
  }

  async function readFile(file: File) {
    setBusy(true);
    setError("");
    try {
      if (file.size > 5_000_000) throw new Error("Choose a file under 5 MB.");
      if (/\.xlsx$/i.test(file.name)) {
        const { default: read } = await import("read-excel-file/browser");
        const book = await read(file);
        const sheets = book.map(({ data }) =>
          data.map((row) =>
            row.map((v) => (v instanceof Date ? v.toISOString() : v == null ? "" : String(v))),
          ),
        );
        accept({ grid: [], name: file.name, sheets, sheetNames: book.map((b) => b.sheet) });
      } else if (/\.xls$/i.test(file.name)) {
        throw new Error("Older .xls files: open it and save as .xlsx or CSV first.");
      } else {
        const text = await file.text();
        accept({
          grid:
            /\.ics$/i.test(file.name) || text.includes("BEGIN:VCALENDAR")
              ? icsToGrid(text)
              : parseCsv(text),
          name: file.name,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't read that file.");
    } finally {
      setBusy(false);
    }
  }

  const built = useMemo(() => {
    if (!grid.length) return null;
    if (kind === "roster") return { kind, ...buildRoster(grid, header.row, map) } as const;
    if (kind === "schedule")
      return {
        kind,
        ...buildSchedule(grid, header.row, map, { ourTeams: ourTeam ? [ourTeam] : [] }),
      } as const;
    return {
      kind,
      ...buildStats(grid, header.headers, header.row, map, { season, category }),
    } as const;
  }, [grid, header, kind, map, ourTeam, season, category]);

  const hasHomeAway =
    kind === "schedule" && (map.home_team >= 0 || map.away_team >= 0) && map.opponent < 0;
  const names = hasHomeAway ? teamNames(grid, header.row, map) : [];
  const sectioned = header.headers.some((h) => /^(batting|pitching):/.test(h));
  const parentCount =
    built?.kind === "roster" ? new Set(built.records.flatMap((r) => r.parents)).size : 0;
  const playerEmails = built?.kind === "roster" ? built.records.filter((r) => r.email).length : 0;
  const count = built?.records.length ?? 0;
  const noun =
    kind === "roster"
      ? `player${count === 1 ? "" : "s"}`
      : kind === "schedule"
        ? `event${count === 1 ? "" : "s"}`
        : `stat line${count === 1 ? "" : "s"}`;

  function submit() {
    if (!built || !count) return;
    setError("");
    const source = platform ?? "other";
    const label = loaded?.name ?? "Pasted data";
    start(async () => {
      const res =
        built.kind === "roster"
          ? await importRoster({ source, label, people: built.records, invite })
          : built.kind === "schedule"
            ? await importSchedule({ source, label, events: built.records })
            : await importStats({ source, season, label, lines: built.records });
      if (res.error) setError(res.error);
      else setDone({ kind, batch: res.batch, summary: res.summary ?? {} });
    });
  }

  // ---------------------------------------------------------------- done
  if (done) {
    const s = done.summary;
    const lines =
      done.kind === "roster"
        ? [
            `${s.created ?? 0} players added${s.matched ? `, ${s.matched} already on your roster updated` : ""}.`,
            s.parent_invites || s.player_invites
              ? `${s.parent_invites ?? 0} parent and ${s.player_invites ?? 0} player invitations ${invite ? "sent" : "created"}.`
              : "No invitations sent. You can invite families any time from Team → Manage.",
          ]
        : done.kind === "schedule"
          ? [
              `${s.games ?? 0} games and ${s.practices ?? 0} practices added.`,
              s.skipped ? `${s.skipped} were already on your calendar, so we skipped them.` : "",
            ]
          : [
              `${s.saved ?? 0} stat lines saved, ${s.matched ?? 0} matched to players on your roster.`,
              s.skipped ? `${s.skipped} were already imported.` : "",
            ];
    return (
      <section
        className="space-y-4 rounded-2xl bg-surface p-5 ring-1 ring-zinc-200 sm:p-7"
        aria-live="polite"
      >
        <h2 className="text-xl font-semibold">
          {done.undone ? "Import undone" : "You're moved in ✓"}
        </h2>
        {done.undone ? (
          <p className="text-sm text-zinc-600">Everything that import added has been removed.</p>
        ) : (
          <ul className="space-y-1 text-sm text-zinc-700" data-testid="import-summary">
            {lines.filter(Boolean).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-3">
          {!done.undone ? (
            <Link
              href={
                done.kind === "schedule"
                  ? "/calendar"
                  : done.kind === "roster"
                    ? "/roster"
                    : "/imports#history"
              }
              className={primary}
            >
              {done.kind === "schedule"
                ? "See the calendar"
                : done.kind === "roster"
                  ? "See the roster"
                  : "See imported stats"}
            </Link>
          ) : null}
          <button
            type="button"
            className={secondary}
            onClick={() => {
              setDone(null);
              setLoaded(null);
              setPaste("");
              setLink("");
            }}
          >
            Bring over another file
          </button>
          {done.batch && !done.undone ? (
            <button
              type="button"
              disabled={pending}
              className="min-h-11 text-sm font-semibold text-red-700"
              onClick={() =>
                start(async () => {
                  const res = await undoImport(done.batch!);
                  if (res.error) setError(res.error);
                  else setDone({ ...done, undone: true });
                })
              }
            >
              Undo this import
            </button>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  // ---------------------------------------------------------------- check
  if (loaded && built) {
    const fields = fieldsFor(kind).filter(
      (f) =>
        kind !== "stats" ||
        ["name", "first_name", "last_name", "jersey", "season", "category"].includes(f.key),
    );
    const matched = fields.filter((f) => map[f.key] >= 0).length;
    return (
      <section className="space-y-5 rounded-2xl bg-surface p-5 ring-1 ring-zinc-200 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-500">{loaded.name}</p>
            <h2 className="text-xl font-semibold" data-testid="import-count">
              {count} {noun} ready
            </h2>
          </div>
          <label className="text-sm font-medium">
            This is a
            <select
              value={kind}
              onChange={(e) => {
                const k = e.target.value as ImportKind;
                setKind(k);
                setMap(matchFields(header.headers, k));
              }}
              className={cn(input, "ml-2")}
            >
              {(Object.keys(KIND_LABEL) as ImportKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loaded.sheetNames && loaded.sheetNames.length > 1 ? (
          <label className="block text-sm font-medium">
            Sheet
            <select
              value={sheet}
              onChange={(e) => {
                try {
                  accept(loaded, Number(e.target.value));
                } catch (err) {
                  setError(err instanceof Error ? err.message : "That sheet is empty.");
                }
              }}
              className={cn(input, "ml-2")}
            >
              {loaded.sheetNames.map((n, i) => (
                <option key={n} value={i}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {kind === "schedule" && hasHomeAway ? (
          <label className="block rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-950 ring-1 ring-amber-200">
            Which team is yours?
            <select
              value={ourTeam}
              onChange={(e) => setOurTeam(e.target.value)}
              className={cn(input, "mt-1 block w-full text-zinc-900")}
            >
              <option value="">Choose…</option>
              {names.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal">
              Other teams&apos; games in the file are skipped.
            </span>
          </label>
        ) : null}

        {kind === "roster" ? (
          <label className="flex min-h-11 items-start gap-3 rounded-xl bg-zinc-50 p-3 text-sm">
            <input
              type="checkbox"
              checked={invite}
              onChange={(e) => setInvite(e.target.checked)}
              className="mt-0.5 size-5 accent-brand-700"
            />
            <span>
              <span className="font-semibold">Invite families now</span>
              <span className="block text-zinc-600">
                {parentCount || playerEmails
                  ? `${parentCount} parent email${parentCount === 1 ? "" : "s"}${playerEmails ? ` and ${playerEmails} player email${playerEmails === 1 ? "" : "s"}` : ""} found. Brothers and sisters share one parent invite. Players without an email are still added; parents get access for them.`
                  : "No emails in this file. Players are still added; invite families later from Team → Manage."}
              </span>
            </span>
          </label>
        ) : null}

        {kind === "stats" ? (
          <div className="flex flex-wrap gap-3">
            <label className="text-sm font-medium">
              Season
              <input
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                maxLength={80}
                className={cn(input, "mt-1 block")}
              />
            </label>
            {!sectioned && map.category < 0 ? (
              <label className="text-sm font-medium">
                These are
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as "batting" | "pitching")}
                  className={cn(input, "mt-1 block")}
                >
                  <option value="batting">Batting stats</option>
                  <option value="pitching">Pitching stats</option>
                </select>
              </label>
            ) : null}
          </div>
        ) : null}

        <details className="rounded-xl ring-1 ring-zinc-200">
          <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold">
            Columns ({matched} matched) · change if something&apos;s wrong
          </summary>
          <div className="grid gap-3 px-3 pb-3 sm:grid-cols-2">
            {fields.map((f) => (
              <label key={f.key} className="text-xs font-medium text-zinc-700">
                {f.label}
                <select
                  value={map[f.key] ?? -1}
                  onChange={(e) => setMap((m) => ({ ...m, [f.key]: Number(e.target.value) }))}
                  className={cn(input, "mt-1 block w-full")}
                >
                  <option value={-1}>Not in this file</option>
                  {header.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {(h || `Column ${i + 1}`).replace(/^[a-z]+:/, (s) =>
                        s.toUpperCase().replace(":", " · "),
                      )}
                      {grid[header.row + 1]?.[i]
                        ? ` (${String(grid[header.row + 1][i]).slice(0, 24)})`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </details>

        {built.problems.length ? (
          <div
            className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200"
            data-testid="import-problems"
          >
            <p className="font-semibold">
              {built.problems.length} row{built.problems.length === 1 ? "" : "s"} need a look (the
              rest import fine)
            </p>
            <ul className="mt-1 max-h-40 space-y-0.5 overflow-auto">
              {built.problems.slice(0, 50).map((p, i) => (
                <li key={i}>
                  Row {p.row}: {p.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {built.skipped.length ? (
          <details className="rounded-xl bg-zinc-50 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-zinc-700">
              {built.skipped.length} row{built.skipped.length === 1 ? "" : "s"} skipped on purpose
            </summary>
            <ul className="mt-1 max-h-40 space-y-0.5 overflow-auto text-zinc-600">
              {built.skipped.slice(0, 100).map((p, i) => (
                <li key={i}>
                  Row {p.row}: {p.message}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <div className="max-h-96 overflow-auto rounded-xl ring-1 ring-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-zinc-50 text-xs text-zinc-600">
              {built.kind === "roster" ? (
                <tr>
                  <th className="px-3 py-2">Player</th>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Pos</th>
                  <th className="px-3 py-2">Group</th>
                  <th className="px-3 py-2">Parents</th>
                </tr>
              ) : built.kind === "schedule" ? (
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">What</th>
                  <th className="px-3 py-2">Where</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-3 py-2">Player</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Line</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {built.kind === "roster"
                ? built.records.slice(0, 100).map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-medium">{r.name}</td>
                      <td className="px-3 py-2">{r.jersey ?? ""}</td>
                      <td className="px-3 py-2">{r.position ?? ""}</td>
                      <td className="px-3 py-2">{r.group ?? ""}</td>
                      <td className="px-3 py-2 text-xs text-zinc-600">{r.parents.join(", ")}</td>
                    </tr>
                  ))
                : built.kind === "schedule"
                  ? built.records.slice(0, 100).map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                        <td className="px-3 py-2">{r.time ?? ""}</td>
                        <td className="px-3 py-2 font-medium">
                          {r.kind === "practice"
                            ? `Practice${r.title && r.title !== "Practice" ? `: ${r.title}` : ""}`
                            : `${r.home_away === "away" ? "@" : "vs"} ${r.opponent}`}
                        </td>
                        <td className="px-3 py-2 text-zinc-600">{r.location ?? ""}</td>
                      </tr>
                    ))
                  : built.records.slice(0, 100).map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-medium">{r.values.name}</td>
                        <td className="px-3 py-2">{r.values.category}</td>
                        <td className="px-3 py-2 text-xs text-zinc-600">
                          {Object.entries(r.values)
                            .filter(([k]) => !["name", "jersey", "season", "category"].includes(k))
                            .map(([k, v]) => `${k} ${v}`)
                            .join(" · ")}
                        </td>
                      </tr>
                    ))}
            </tbody>
          </table>
        </div>

        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={primary}
            disabled={pending || !count || (hasHomeAway && !ourTeam)}
            onClick={submit}
          >
            {pending ? "Importing…" : `Import ${count} ${noun}`}
          </button>
          <button type="button" className={secondary} onClick={() => setLoaded(null)}>
            Back
          </button>
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------- choose
  const guide = platform ? GUIDES[platform] : null;
  return (
    <section className="space-y-6 rounded-2xl bg-surface p-5 ring-1 ring-zinc-200 sm:p-7">
      <div>
        <h2 className="text-xl font-semibold">Where is your team now?</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PLATFORMS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={platform === p.key}
              onClick={() => setPlatform(p.key)}
              className={cn(
                "min-h-16 rounded-xl p-3 text-left ring-1",
                platform === p.key
                  ? "bg-brand-50 ring-2 ring-brand-600"
                  : "ring-zinc-200 hover:bg-zinc-50",
              )}
            >
              <span className="block text-sm font-semibold">{p.name}</span>
              <span className="block text-xs text-zinc-600">{p.blurb}</span>
            </button>
          ))}
        </div>
      </div>

      {guide ? (
        <div className="grid gap-3 sm:grid-cols-2" data-testid="export-guide">
          {(["roster", "schedule", "stats"] as const).map((k) =>
            guide[k] ? (
              <div key={k} className="rounded-xl bg-zinc-50 p-3 text-sm">
                <p className="font-semibold">{KIND_LABEL[k]}</p>
                <ol className="mt-1 list-decimal space-y-1 pl-5 text-zinc-700">
                  {guide[k]!.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            ) : null,
          )}
          {guide.note ? <p className="text-xs text-zinc-600 sm:col-span-2">{guide.note}</p> : null}
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="rounded-xl border-2 border-dashed border-zinc-300 p-6 text-center">
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            accept=".csv,.tsv,.txt,.xlsx,.xls,.ics"
            aria-label="Choose an export file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void readFile(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className={primary}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? "Reading…" : "Upload the export"}
          </button>
          <p className="mt-2 text-xs text-zinc-500">
            CSV, Excel (.xlsx) or calendar (.ics) · up to 5 MB · 1,000 rows
          </p>
        </div>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            void fetchCalendar(link).then((res) => {
              setBusy(false);
              if (res.error || !res.text) return setError(res.error ?? "That calendar was empty.");
              try {
                accept({ grid: icsToGrid(res.text), name: "Calendar link" });
              } catch (err) {
                setError(err instanceof Error ? err.message : "We couldn't read that calendar.");
              }
            });
          }}
        >
          <label className="flex-1 text-sm font-medium">
            <span className="sr-only">Calendar link</span>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Or paste a calendar link (webcal:// or https://…)"
              className={cn(input, "w-full")}
            />
          </label>
          <button type="submit" className={secondary} disabled={busy || !link.trim()}>
            Load schedule
          </button>
        </form>
        <details className="rounded-xl ring-1 ring-zinc-200">
          <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold">
            Or paste from a spreadsheet
          </summary>
          <div className="space-y-2 px-3 pb-3">
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={6}
              placeholder="Select the cells (with the heading row) in Sheets or Excel, copy, and paste here."
              aria-label="Pasted spreadsheet cells"
              className="w-full rounded-lg bg-surface p-3 font-mono text-xs ring-1 ring-zinc-300"
            />
            <button
              type="button"
              className={secondary}
              disabled={!paste.trim()}
              onClick={() => {
                try {
                  accept({ grid: parseCsv(paste), name: "Pasted cells" });
                } catch (err) {
                  setError(err instanceof Error ? err.message : "We couldn't read that.");
                }
              }}
            >
              Use these cells
            </button>
          </div>
        </details>
      </div>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
