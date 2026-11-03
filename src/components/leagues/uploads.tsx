"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { fetchTeamCalendar, importGames, setLogo, type ImportGame } from "@/lib/league-actions";
import { parseCsv } from "@/lib/imports/parse";
import { buildSchedule, findHeader, icsToGrid, matchFields, teamNames } from "@/lib/imports/smart";
import { clock, logoUrl } from "@/lib/leagues";
import { day } from "@/lib/staff-pay";
import { TeamLogo } from "./team-logo";
import { cn } from "@/lib/utils";

type R = { error?: string; ok?: string };

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

/** Square-crop and shrink to 512px WebP (also drops photo metadata). */
async function squareWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(512, side);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  g.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.9));
  if (!blob) throw new Error("bad image");
  return blob;
}

export function LogoUpload({
  teamId,
  name,
  logoPath,
}: {
  teamId: string;
  name: string;
  logoPath: string | null;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [r, setR] = useState<R>({});
  const [pending, start] = useTransition();
  const upload = (file: File) =>
    start(async () => {
      setR({});
      if (!/^image\/(png|jpeg|webp)$/.test(file.type))
        return setR({ error: "Use a PNG, JPG or WebP image." });
      if (file.size > 10_000_000) return setR({ error: "Choose an image under 10 MB." });
      try {
        const blob = await squareWebp(file);
        const path = `${teamId}/${crypto.randomUUID()}.webp`;
        const { error } = await createClient()
          .storage.from("team-logos")
          .upload(path, blob, { contentType: "image/webp", cacheControl: "31536000" });
        if (error) return setR({ error: "The logo didn't upload. Try again." });
        const res = await setLogo(teamId, path);
        setR(res);
        if (!res.error) router.refresh();
      } catch {
        setR({ error: "We couldn't read that image. Try a PNG or JPG." });
      }
    });
  return (
    <div className="flex flex-wrap items-center gap-4">
      <TeamLogo name={name} src={logoUrl(logoPath)} className="size-20 rounded-2xl text-2xl" />
      <div className="space-y-2">
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label="Team logo"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => input.current?.click()}
          >
            {pending ? "Uploading…" : logoPath ? "Change logo" : "Upload logo"}
          </Button>
          {logoPath ? (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await setLogo(teamId, null);
                  setR(res);
                  if (!res.error) router.refresh();
                })
              }
            >
              Remove
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-zinc-500">PNG, JPG or WebP. Square works best.</p>
        <Note r={r} />
      </div>
    </div>
  );
}

type Source = { grid: string[][]; name: string };

/** Bring in a whole schedule: a file (CSV, Excel, calendar), pasted cells or a calendar link. */
export function ScheduleImport({ teamId, teamName }: { teamId: string; teamName: string }) {
  const router = useRouter();
  const [source, setSource] = useState<Source | null>(null);
  const [mode, setMode] = useState<"file" | "paste" | "link">("file");
  const [paste, setPaste] = useState("");
  const [link, setLink] = useState("");
  const [ours, setOurs] = useState<string>("");
  const [r, setR] = useState<R>({});
  const [pending, start] = useTransition();

  async function readFile(file: File) {
    setR({});
    if (file.size > 5_000_000) return setR({ error: "Choose a file under 5 MB." });
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const { default: read } = await import("read-excel-file/browser");
        const book = await read(file);
        const sheet = [...book].sort((a, b) => b.data.length - a.data.length)[0];
        const grid = (sheet?.data ?? []).map((row) =>
          row.map((v) => (v instanceof Date ? v.toISOString() : v == null ? "" : String(v))),
        );
        setSource({ grid, name: file.name });
      } else if (/\.xls$/i.test(file.name)) {
        setR({ error: "Older .xls files: open it and save as .xlsx or CSV first." });
      } else {
        const text = await file.text();
        setSource({
          grid:
            /\.ics$/i.test(file.name) || text.includes("BEGIN:VCALENDAR")
              ? icsToGrid(text)
              : parseCsv(text),
          name: file.name,
        });
      }
    } catch {
      setR({ error: "We couldn't read that file." });
    }
  }

  const parsed = useMemo(() => {
    if (!source?.grid.length) return null;
    const header = findHeader(source.grid);
    const map = matchFields(header.headers, "schedule");
    const names = teamNames(source.grid, header.row, map);
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const guess =
      names.find((n) => norm(n) === norm(teamName)) ??
      names.find((n) => norm(teamName).includes(norm(n)) || norm(n).includes(norm(teamName))) ??
      "";
    const pick = names.length ? ours || guess : "";
    const built = buildSchedule(source.grid, header.row, map, { ourTeams: pick ? [pick] : [] });
    const games: ImportGame[] = built.records
      .filter((e) => e.kind === "game" && e.opponent)
      .map((e) => ({
        date: e.date,
        time: e.time,
        opponent: e.opponent!,
        home_away: e.home_away,
        location: e.location,
      }));
    return {
      names,
      pick,
      games,
      practices: built.records.length - games.length,
      problems: built.problems.length,
      skipped: built.skipped.length,
    };
  }, [source, ours, teamName]);

  const reset = () => {
    setSource(null);
    setOurs("");
    setPaste("");
  };

  if (source && parsed)
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-700">
          From <b>{source.name}</b>: <b>{parsed.games.length}</b> game
          {parsed.games.length === 1 ? "" : "s"}
          {parsed.practices ? ` · ${parsed.practices} practices left out` : ""}
          {parsed.skipped ? ` · ${parsed.skipped} skipped` : ""}
          {parsed.problems ? ` · ${parsed.problems} rows we couldn't read` : ""}
        </p>
        {parsed.names.length > 1 ? (
          <label className="block space-y-1.5 text-sm font-medium text-zinc-800">
            <span className="block">Which team is yours?</span>
            <select
              value={parsed.pick}
              onChange={(e) => setOurs(e.target.value)}
              className="block h-11 w-full rounded-lg bg-surface px-3 text-zinc-900 ring-1 ring-zinc-300 ring-inset"
            >
              <option value="">Choose…</option>
              {parsed.names.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {parsed.games.length ? (
          <ul className="max-h-72 divide-y divide-zinc-200 overflow-y-auto rounded-xl ring-1 ring-zinc-200">
            {parsed.games.map((g, i) => (
              <li key={i} className="flex justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  {g.home_away === "away" ? "@" : "vs"} {g.opponent}
                  {g.location ? <span className="text-zinc-500"> · {g.location}</span> : null}
                </span>
                <span className="shrink-0 text-zinc-600 tabular-nums">
                  {day(g.date)}
                  {g.time ? ` · ${clock(g.time)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-600">
            No games found. The file needs a date and an opponent (or home and away teams) on each
            row.
          </p>
        )}
        <Note r={r} />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={pending || !parsed.games.length}
            onClick={() =>
              start(async () => {
                const res = await importGames(teamId, parsed.games);
                setR(res);
                if (!res.error) {
                  reset();
                  router.refresh();
                }
              })
            }
          >
            {pending
              ? "Adding…"
              : `Add ${parsed.games.length} game${parsed.games.length === 1 ? "" : "s"}`}
          </Button>
          <Button type="button" variant="ghost" onClick={reset}>
            Start over
          </Button>
        </div>
      </div>
    );

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Where's your schedule?" className="flex flex-wrap gap-2">
        {(
          [
            ["file", "Upload a file"],
            ["paste", "Paste from a spreadsheet"],
            ["link", "Calendar link"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={mode === k}
            onClick={() => setMode(k)}
            className={cn(
              "h-10 rounded-full px-4 text-sm font-semibold ring-1",
              mode === k
                ? "bg-zinc-900 text-zinc-50 ring-zinc-900"
                : "bg-surface text-zinc-700 ring-zinc-200 hover:bg-zinc-50",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "file" ? (
        <label className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-zinc-300 px-4 py-6 text-center hover:bg-zinc-50">
          <span className="font-semibold text-brand-700">Choose a schedule file</span>
          <span className="text-xs text-zinc-500">
            CSV, Excel (.xlsx) or calendar (.ics) from GameChanger, TeamSnap, your league or Google
            Calendar
          </span>
          <input
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls,.ics"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void readFile(f);
              e.target.value = "";
            }}
          />
        </label>
      ) : mode === "paste" ? (
        <div className="space-y-2">
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={6}
            aria-label="Pasted schedule"
            placeholder={
              "Date\tTime\tOpponent\tHome/Away\tLocation\n3/14/2027\t6:00 PM\tEagles\tHome\tMemorial Park"
            }
            className="block w-full rounded-lg bg-surface px-3 py-2 font-mono text-sm text-zinc-900 ring-1 ring-zinc-300 ring-inset"
          />
          <Button
            type="button"
            variant="secondary"
            disabled={!paste.trim()}
            onClick={() => setSource({ grid: parseCsv(paste), name: "Pasted cells" })}
          >
            Read schedule
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            aria-label="Calendar link"
            placeholder="webcal://… or https://….ics"
            className="h-11 min-w-0 flex-1 rounded-lg bg-surface px-3 text-zinc-900 ring-1 ring-zinc-300 ring-inset"
          />
          <Button
            type="button"
            variant="secondary"
            disabled={pending || !link.trim()}
            onClick={() =>
              start(async () => {
                setR({});
                const res = await fetchTeamCalendar(link);
                if (res.error || !res.text)
                  setR({ error: res.error ?? "That calendar was empty." });
                else setSource({ grid: icsToGrid(res.text), name: "Calendar link" });
              })
            }
          >
            {pending ? "Loading…" : "Read calendar"}
          </Button>
        </div>
      )}
      <Note r={r} />
    </div>
  );
}
