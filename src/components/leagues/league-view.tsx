import Link from "next/link";
import { logoUrl, clock } from "@/lib/leagues";
import { day } from "@/lib/staff-pay";
import { gbText, pctText, type ResolvedGame, type StandingRow } from "@/lib/league-standings";
import type { TeamCard } from "@/lib/leagues-data";
import { TeamLogo } from "./team-logo";
import { cn } from "@/lib/utils";

export function StandingsTable({
  title,
  rows,
  teams,
}: {
  title?: string;
  rows: StandingRow[];
  teams: Map<string, TeamCard>;
}) {
  const ties = rows.some((r) => r.t > 0);
  const th = "w-10 px-1.5 py-2 text-right font-medium sm:w-12";
  const td = "px-1.5 py-2.5 text-right tabular-nums";
  return (
    <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-zinc-200">
      {title ? (
        <h3 className="border-b border-zinc-200 px-4 py-2.5 text-sm font-semibold">{title}</h3>
      ) : null}
      <table className="w-full table-fixed text-sm">
        <thead className="text-xs text-zinc-500">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Team</th>
            <th className={th}>W</th>
            <th className={th}>L</th>
            {ties ? <th className={th}>T</th> : null}
            <th className={cn(th, "w-13 sm:w-14")}>PCT</th>
            <th className={th}>GB</th>
            <th className={cn(th, "hidden sm:table-cell")}>RF</th>
            <th className={cn(th, "hidden sm:table-cell")}>RA</th>
            <th className={cn(th, "w-11 sm:w-12")}>DIFF</th>
            <th className={cn(th, "hidden pr-4 sm:table-cell")}>STRK</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {rows.map((r, i) => {
            const t = teams.get(r.teamId);
            return (
              <tr key={r.teamId}>
                <td className="px-3 py-2.5 sm:px-4">
                  <Link
                    href={t ? `/leagues/t/${t.slug}` : "#"}
                    className="flex min-w-0 items-center gap-2 font-medium hover:underline"
                  >
                    <span className="w-4 shrink-0 text-xs text-zinc-500 tabular-nums">{i + 1}</span>
                    <TeamLogo
                      name={t?.name ?? "Team"}
                      src={logoUrl(t?.logo_path)}
                      className="size-6 rounded-md text-[10px]"
                    />
                    <span className="truncate">{t?.name ?? "Team"}</span>
                  </Link>
                </td>
                <td className={td}>{r.w}</td>
                <td className={td}>{r.l}</td>
                {ties ? <td className={td}>{r.t}</td> : null}
                <td className={cn(td, "font-semibold")}>{pctText(r.pct)}</td>
                <td className={td}>{gbText(r.gb)}</td>
                <td className={cn(td, "hidden sm:table-cell")}>{r.rf}</td>
                <td className={cn(td, "hidden sm:table-cell")}>{r.ra}</td>
                <td
                  className={cn(
                    td,
                    r.diff > 0 ? "text-brand-700" : r.diff < 0 ? "text-red-700" : "",
                  )}
                >
                  {r.diff > 0 ? `+${r.diff}` : r.diff}
                </td>
                <td className={cn(td, "hidden pr-4 sm:table-cell")}>{r.streak || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  final: { label: "Final", cls: "text-zinc-500" },
  live: { label: "Live", cls: "text-red-700" },
  disputed: { label: "Score disputed", cls: "text-amber-900" },
  postponed: { label: "Postponed", cls: "text-amber-900" },
  canceled: { label: "Canceled", cls: "text-amber-900" },
};

/** Away team over home team, with scores (box-score style). */
export function LeagueGame({
  g,
  teams,
  showDate = true,
}: {
  g: ResolvedGame;
  teams: Map<string, TeamCard>;
  showDate?: boolean;
}) {
  const sides = [
    { id: g.away_team_id, runs: g.away },
    { id: g.home_team_id, runs: g.home },
  ];
  const scored = g.shown === "final" || g.shown === "live";
  const winner =
    g.shown === "final" && g.home != null && g.away != null && g.home !== g.away
      ? g.home > g.away
        ? g.home_team_id
        : g.away_team_id
      : null;
  const st = STATUS[g.shown];
  return (
    <div className="space-y-1.5 px-4 py-3">
      <p className="flex justify-between gap-2 text-xs text-zinc-500">
        <span className="truncate">
          {[showDate ? day(g.date) : null, clock(g.start_time), g.location]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {st ? (
          <span className={cn("shrink-0 font-semibold", st.cls)}>
            {g.shown === "live" ? (
              <span
                aria-hidden
                className="mr-1 inline-block size-1.5 animate-pulse rounded-full bg-red-600"
              />
            ) : null}
            {st.label}
            {g.shown === "live" && g.inning ? ` · Inn ${g.inning}` : ""}
          </span>
        ) : null}
      </p>
      {sides.map((s, i) => {
        const t = teams.get(s.id);
        return (
          <div key={s.id} className="flex items-center gap-2">
            <TeamLogo
              name={t?.name ?? "Team"}
              src={logoUrl(t?.logo_path)}
              className="size-6 rounded-md text-[10px]"
            />
            <Link
              href={t ? `/leagues/t/${t.slug}` : "#"}
              className={cn(
                "min-w-0 flex-1 truncate hover:underline",
                winner === s.id ? "font-semibold" : winner ? "text-zinc-600" : "",
              )}
            >
              {t?.name ?? "Team"}
              {i === 1 ? <span className="sr-only"> (home)</span> : null}
            </Link>
            {scored ? (
              <b
                className={cn(
                  "tabular-nums",
                  winner && winner !== s.id ? "font-normal text-zinc-600" : "",
                )}
              >
                {s.runs ?? 0}
              </b>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function LeagueLine({
  l,
}: {
  l: {
    slug: string;
    name: string;
    season: string | null;
    city: string | null;
    state: string | null;
  };
}) {
  return (
    <Link
      href={`/leagues/l/${l.slug}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50"
    >
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-lg ring-1 ring-brand-200"
      >
        🏆
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate">{l.name}</b>
        <span className="block truncate text-sm text-zinc-500">
          {[l.season, [l.city, l.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span aria-hidden className="text-zinc-400">
        →
      </span>
    </Link>
  );
}
