import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { playerToday } from "@/lib/player";
import {
  loadPlayerNames,
  loadSeasonLines,
  loadStatYears,
  seasonParams,
  statsViewer,
} from "@/lib/stats-data";
import { regulationInnings, seasonByPlayer } from "@/lib/stats";
import { Leaders } from "@/components/stats/leaders";
import { SeasonFilter } from "@/components/stats/season-filter";
import { SeasonTables } from "@/components/stats/season-tables";
import { VisibilityForm } from "./visibility-form";

export const metadata: Metadata = { title: "Stats" };

const fmtDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export default async function StatsPage({ searchParams }: PageProps<"/stats">) {
  const { supabase, org, isStaff, membership, visibility } = await statsViewer();
  if (!isStaff) redirect("/player/stats");
  const sp = await searchParams;
  const { today } = await playerToday();
  const { year, includeScrimmages } = seasonParams(sp, today);

  const [years, season, { data: finals }] = await Promise.all([
    loadStatYears(supabase, org.id, Number(today.slice(0, 4))),
    loadSeasonLines(supabase, org.id, { year, includeScrimmages }),
    supabase
      .from("games")
      .select("id, date, opponent, home_away, kind")
      .eq("org_id", org.id)
      .eq("status", "final")
      .gte("date", `${year}-01-01`)
      .lte("date", `${year}-12-31`)
      .order("date", { ascending: false }),
  ]);
  const names = await loadPlayerNames(
    supabase,
    org.id,
    [...season.batting, ...season.pitching].map((l) => l.playerId),
  );
  const seasons = seasonByPlayer(season.batting, season.pitching);
  const innings = regulationInnings(season.games);
  const teamGames = season.games.length;
  const withStats = new Set(season.games.map((g) => g.id));
  const missing = (finals ?? []).filter(
    (g) => !withStats.has(g.id) && (includeScrimmages || g.kind !== "scrimmage"),
  );

  return (
    <div className="max-w-6xl space-y-6">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stats</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Season stats from your box scores. Enter a box score from any game&apos;s page.
          </p>
        </div>
        <SeasonFilter
          basePath="/stats"
          years={years}
          year={year}
          includeScrimmages={includeScrimmages}
        />
        <p className="text-xs text-zinc-500">
          {teamGames} game{teamGames === 1 ? "" : "s"} with stats in {year}
          {includeScrimmages ? ", scrimmages included" : ", scrimmages left out"}.
        </p>
      </div>

      {teamGames === 0 ? (
        <p className="rounded-xl bg-white p-8 text-center text-sm text-zinc-500 ring-1 ring-zinc-200">
          No box scores for {year} yet. Open a game and choose <strong>Enter box score</strong>.
        </p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Leaders</h2>
            <Leaders seasons={seasons} names={names} innings={innings} teamGames={teamGames} />
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Team</h2>
            <SeasonTables
              seasons={seasons}
              names={names}
              innings={innings}
              teamGames={teamGames}
              hrefFor={(id) => `/roster/${id}#game-stats`}
            />
          </section>
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Box scores</h2>
          {season.games.length === 0 && missing.length === 0 ? (
            <p className="text-sm text-zinc-500">No final games yet this season.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-xl bg-white ring-1 ring-zinc-200">
              {missing.map((g) => (
                <li key={g.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="w-14 text-zinc-500 tabular-nums">{fmtDay(g.date)}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {g.home_away === "away" ? "@" : "vs"} {g.opponent}
                  </span>
                  <Link
                    href={`/games/${g.id}/stats`}
                    className="font-semibold text-brand-700 hover:underline"
                  >
                    Enter box score
                  </Link>
                </li>
              ))}
              {season.games.map((g) => (
                <li key={g.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="w-14 text-zinc-500 tabular-nums">{fmtDay(g.date)}</span>
                  <Link href={`/games/${g.id}`} className="min-w-0 flex-1 truncate hover:underline">
                    {g.homeAway === "away" ? "@" : "vs"} {g.opponent}
                    {g.teamScore != null && g.opponentScore != null
                      ? ` · ${g.teamScore}–${g.opponentScore}`
                      : ""}
                  </Link>
                  <Link
                    href={`/games/${g.id}/stats`}
                    className="text-zinc-500 hover:text-brand-700 hover:underline"
                  >
                    Edit
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="visibility" className="space-y-3">
          <h2 className="text-lg font-semibold">Team setting</h2>
          <div className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
            <VisibilityForm current={visibility} canEdit={membership.role === "admin"} />
          </div>
        </section>
      </div>
    </div>
  );
}
