"use client";
import { useRef, useState, useTransition } from "react";
import {
  COLUMNS,
  guessMapping,
  mapRows,
  parseCsv,
  validateRows,
  type ImportKind,
  type ImportSource,
} from "@/lib/imports/parse";
import { saveImport } from "./actions";

const SOURCES: { id: ImportSource; title: string; detail: string }[] = [
  { id: "sheets", title: "Google Sheets", detail: "Download a sheet as CSV or Excel" },
  { id: "excel", title: "Excel", detail: "Upload an .xlsx workbook or CSV" },
  { id: "gamechanger", title: "GameChanger", detail: "Upload an available CSV / Excel export" },
  { id: "other", title: "Another app", detail: "Use its spreadsheet export" },
];
export function ImportWizard() {
  const [source, setSource] = useState<ImportSource>("sheets");
  const [kind, setKind] = useState<ImportKind>("roster");
  const [category, setCategory] = useState("batting");
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [grid, setGrid] = useState<string[][]>([]);
  const [sheets, setSheets] = useState<{ sheet: string }[]>([]);
  const [sheet, setSheet] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [stage, setStage] = useState<"upload" | "map" | "review" | "done">("upload");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ saved?: number; skipped?: number }>({});
  const [reading, setReading] = useState(false);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const rows = grid.length
    ? mapRows(grid, mapping).map((row) =>
        kind === "stats" ? { ...row, category: row.category || category } : row,
      )
    : [];
  const checked = validateRows(kind, rows, season);
  const cls = "rounded-lg border border-zinc-300 bg-surface px-3 py-2 text-sm";
  const primary =
    "rounded-lg bg-brand-700 px-5 py-3 text-sm font-semibold text-on-brand disabled:opacity-40";
  async function loadFile(next: File, sheetNumber = 1) {
    setReading(true);
    setError("");
    try {
      if (next.size > 5_000_000) throw new Error("Choose a file smaller than 5 MB.");
      let cells: string[][];
      if (/\.xlsx$/i.test(next.name)) {
        const { default: read } = await import("read-excel-file/browser");
        const workbook = await read(next);
        setSheets(workbook.map(({ sheet }) => ({ sheet })));
        const raw = workbook[sheetNumber - 1].data;
        cells = raw.map((row) =>
          row.map((value) =>
            value instanceof Date ? value.toISOString() : value == null ? "" : String(value),
          ),
        );
      } else if (/\.(csv|tsv|txt)$/i.test(next.name)) {
        cells = parseCsv(await next.text());
        setSheets([]);
      } else
        throw new Error(
          "Choose a CSV or .xlsx file. For older .xls workbooks, save as .xlsx or CSV first.",
        );
      cells = cells.filter((row) => row.some((cell) => cell.trim()));
      if (cells.length < 2) throw new Error("Include a header row and at least one data row.");
      if (cells.length > 1001 || cells.some((row) => row.length > 100))
        throw new Error("Use up to 1,000 data rows and 100 columns at a time.");
      setFile(next);
      setSheet(sheetNumber);
      setGrid(cells);
      setMapping(guessMapping(cells[0], kind));
      setStage("map");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this file.");
    } finally {
      setReading(false);
    }
  }
  function template() {
    const headers =
      kind === "roster"
        ? "Player Name,Jersey Number,Position,Player Email"
        : kind === "schedule"
          ? "Opponent,Date,Start Time,Home/Away,Location"
          : "Player Name,Season,G,PA,AB,R,H,2B,3B,HR,RBI,BB,SO,SB,AVG";
    const url = URL.createObjectURL(new Blob([headers + "\r\n"], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kind}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section
      className="rounded-2xl border border-zinc-200 bg-surface p-5 sm:p-7"
      aria-label="Team import wizard"
    >
      <ol className="mb-7 flex flex-wrap gap-4 text-xs text-zinc-400">
        {["Choose file", "Match columns", "Review", "Done"].map((label, i) => (
          <li
            className={
              i === ["upload", "map", "review", "done"].indexOf(stage)
                ? "font-semibold text-brand-700"
                : ""
            }
            key={label}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>
      {stage === "upload" && (
        <>
          <h2 className="text-xl font-semibold">Where is your team’s data?</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {SOURCES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSource(s.id)}
                aria-pressed={source === s.id}
                className={`rounded-xl border p-4 text-left ${source === s.id ? "border-brand-700 bg-brand-50" : "border-zinc-200"}`}
              >
                <b className="block text-sm">{s.title}</b>
                <span className="mt-1 block text-xs text-zinc-500">{s.detail}</span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-zinc-600">
            {source === "sheets"
              ? "In Google Sheets: File → Download → Comma-separated values (.csv). Export each tab separately, or download the whole workbook as Excel."
              : source === "gamechanger"
                ? "Export the roster, schedule, or stats you can access in GameChanger, then choose that file here. Available exports vary. This does not connect to your GameChanger account; if an export isn’t available, use the template below."
                : "Put column headings in the first row. We’ll match common column names, and you can adjust them before importing."}
          </p>
          <div className="my-5 flex flex-wrap gap-4">
            <label className="flex flex-col gap-2 text-xs font-medium">
              Bring over
              <select
                className={cls}
                value={kind}
                onChange={(e) => setKind(e.target.value as ImportKind)}
              >
                <option value="roster">Roster</option>
                <option value="schedule">Schedule</option>
                <option value="stats">Historical stats</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs font-medium">
              Season label
              <input
                className={cls}
                maxLength={80}
                value={season}
                placeholder="2026 Spring · Varsity"
                onChange={(e) => setSeason(e.target.value)}
              />
            </label>
          </div>
          {kind === "stats" && (
            <label className="mb-5 flex flex-col gap-2 text-xs font-medium">
              Historical stat type
              <select
                className={cls}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="batting">Batting</option>
                <option value="pitching">Pitching</option>
                <option value="combined">Combined batting + pitching</option>
              </select>
              <span className="font-normal text-zinc-500">
                Batting and pitching exports are kept as separate snapshots, so one won’t replace
                the other.
              </span>
            </label>
          )}
          <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-7 text-center">
            <p className="mb-3 text-sm font-medium">No need to retype your team.</p>
            <input
              ref={fileRef}
              className="sr-only"
              type="file"
              accept=".csv,.tsv,.txt,.xlsx"
              aria-label="Choose import file"
              onChange={(e) => {
                const next = e.target.files?.[0];
                if (next) void loadFile(next);
                e.target.value = "";
              }}
            />
            <button className={primary} disabled={reading} onClick={() => fileRef.current?.click()}>
              {reading ? "Reading file…" : "Choose a spreadsheet"}
            </button>
            <p className="mt-3 text-xs text-zinc-500">
              CSV or Excel (.xlsx) · up to 5 MB · 1,000 rows
            </p>
          </div>
          <button className="mt-4 text-sm text-brand-700 underline" onClick={template}>
            Download a {kind === "stats" ? "historical stats" : kind} template
          </button>
        </>
      )}
      {stage === "map" && (
        <>
          <h2 className="text-xl font-semibold">Match your columns</h2>
          <p className="mt-2 text-sm text-zinc-500">
            {file?.name} · {grid.length - 1} rows. Unmapped columns won’t be imported.
          </p>
          {sheets.length > 1 && (
            <label className="my-4 flex flex-col gap-2 text-xs">
              Workbook sheet
              <select
                className={cls}
                value={sheet}
                disabled={reading}
                onChange={(e) => {
                  if (file) void loadFile(file, Number(e.target.value));
                }}
              >
                {sheets.map((s, i) => (
                  <option value={i + 1} key={s.sheet}>
                    {s.sheet}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {COLUMNS[kind].map((c) => (
              <label className="flex flex-col gap-1 text-xs font-medium" key={c.key}>
                {c.label}
                {c.required ? " *" : ""}
                <select
                  className={cls}
                  value={mapping[c.key] ?? -1}
                  onChange={(e) => setMapping((m) => ({ ...m, [c.key]: Number(e.target.value) }))}
                >
                  <option value={-1}>Don’t import</option>
                  {grid[0]?.map((h, i) => (
                    <option value={i} key={i}>
                      {h || `Column ${i + 1}`} · {grid[1]?.[i]?.slice(0, 30) || "empty"}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            {kind === "roster"
              ? "No player email? That’s fine. Import names now and invite players later. Separate first and last name columns are supported."
              : kind === "stats"
                ? "Import one row per player per season, for one team and competition scope. IP uses innings.outs (12.2), not decimal innings. Unsupported metrics stay in your source file."
                : "Dates: YYYY-MM-DD or M/D/YYYY. Times use the same local team time as the Games calendar. Missing home/away defaults to home. Missing time stays unset."}
          </p>
          <div className="mt-5 flex gap-4">
            <button className={cls} onClick={() => setStage("upload")}>
              Back
            </button>
            <button
              className={primary}
              disabled={reading}
              onClick={() => {
                setError("");
                setStage("review");
              }}
            >
              Review import →
            </button>
          </div>
        </>
      )}
      {stage === "review" && (
        <>
          <h2 className="text-xl font-semibold">One last look.</h2>
          <p className="mt-2 text-sm text-zinc-600">
            {checked.rows.length} unique{" "}
            {kind === "roster" ? "players" : kind === "schedule" ? "games" : "stat snapshots"} ·{" "}
            {season} · {SOURCES.find((s) => s.id === source)?.title}
          </p>
          {checked.duplicates > 0 && (
            <p className="mt-3 text-sm text-amber-700">
              {checked.duplicates} identical duplicate rows will be skipped.
            </p>
          )}
          {checked.errors.length > 0 && (
            <div className="mt-4 rounded-lg bg-red-50 p-4 text-xs text-red-800" role="alert">
              <b>
                Fix {checked.errors.length} issue{checked.errors.length === 1 ? "" : "s"} before
                saving:
              </b>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {checked.errors.slice(0, 20).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
              {checked.errors.length > 20 && <p>Showing the first 20 issues.</p>}
            </div>
          )}
          <div className="my-5 max-h-80 overflow-auto rounded-lg border border-zinc-200">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  {COLUMNS[kind]
                    .filter(
                      (c) => (mapping[c.key] ?? -1) >= 0 || (kind === "roster" && c.key === "name"),
                    )
                    .map((c) => (
                      <th key={c.key} className="sticky top-0 bg-zinc-50 p-3 whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {checked.rows.slice(0, 50).map((row, i) => (
                  <tr className="border-t border-zinc-100" key={i}>
                    {COLUMNS[kind]
                      .filter(
                        (c) =>
                          (mapping[c.key] ?? -1) >= 0 || (kind === "roster" && c.key === "name"),
                      )
                      .map((c) => (
                        <td className="p-3 whitespace-nowrap" key={c.key}>
                          {row.values[c.key] || "—"}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-5 text-zinc-500">
            Showing up to 50 rows. Existing imports with the same player/game and season will be
            skipped, never overwritten.{" "}
            {kind === "roster"
              ? "Players will be saved in Imported data; no accounts or invitations are created."
              : kind === "stats"
                ? "These are historical snapshots. They won’t be added to live-game season totals."
                : "Games will be added to the calendar as scheduled games. Existing matching games are skipped."}
          </p>
          <div className="mt-5 flex gap-4">
            <button className={cls} disabled={pending} onClick={() => setStage("map")}>
              Edit columns
            </button>
            <button
              className={primary}
              disabled={pending || !!checked.errors.length}
              onClick={() => {
                setError("");
                start(async () => {
                  try {
                    const res = await saveImport({ kind, source, season, rows });
                    if (res.error) setError(res.error);
                    else {
                      setResult(res);
                      setStage("done");
                    }
                  } catch {
                    setError(
                      "Couldn’t confirm the save. Reopen Imported data or retry; duplicate rows will be skipped.",
                    );
                  }
                });
              }}
            >
              {pending
                ? "Importing…"
                : `Confirm ${kind === "stats" ? "historical stats" : kind} import`}
            </button>
          </div>
        </>
      )}
      {stage === "done" && (
        <>
          <div className="text-3xl text-brand-700">✓</div>
          <h2 className="mt-3 text-xl font-semibold">Your data is here.</h2>
          <p className="mt-3 text-sm text-zinc-600">
            {result.saved} rows imported. {result.skipped ?? 0} duplicates skipped.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            {kind === "schedule"
              ? "Your schedule is ready in Games."
              : "Review your imported data below. You can invite players separately from Roster."}
          </p>
          <button
            className={`${primary} mt-5`}
            onClick={() => {
              setStage("upload");
              setGrid([]);
              setFile(null);
              setKind(kind === "roster" ? "schedule" : kind === "schedule" ? "stats" : "roster");
            }}
          >
            Continue with{" "}
            {kind === "roster"
              ? "schedule"
              : kind === "schedule"
                ? "historical stats"
                : "another roster"}{" "}
            →
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
