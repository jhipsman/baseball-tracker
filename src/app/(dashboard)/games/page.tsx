import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { formatRecord, loadGames, loadTournaments, recordOf, type Game } from "@/lib/games";
import { GameList, TournamentSummary } from "@/components/games/game-ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Games" };

const VIEWS = ["upcoming", "results", "tournaments"] as const;
type View = (typeof VIEWS)[number];

const isUpcoming = (g: Game, today: string) =>
  g.status === "live" || (g.date >= today && g.status !== "final");

export default async function GamesPage({ searchParams }: PageProps<"/games">) {
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect("/player/games");
  const params = await searchParams;
  const view: View = VIEWS.includes(params.view as View) ? (params.view as View) : "upcoming";
  const added = Number(params.added) || 0;
  const { today } = await playerToday();
  const year = today.slice(0, 4);

  const [games, tournaments] = await Promise.all([
    loadGames(supabase, org.id, null, null),
    loadTournaments(supabase, org.id),
  ]);
  const season = games.filter((g) => g.date.startsWith(year));
  const record = recordOf(season);
  const played = record.w + record.l + record.t;

  const upcoming = games.filter((g) => isUpcoming(g, today));
  const results = games.filter((g) => !isUpcoming(g, today)).toReversed();

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Games</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {year} record{" "}
            <span data-testid="season-record" className="font-semibold text-zinc-900 tabular-nums">
              {formatRecord(record, true)}
            </span>
            {played > 0 ? " (W–L–T, scrimmages not counted)" : " · no final scores yet"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/games/quick"
            className="inline-flex h-11 items-center rounded-lg px-4 text-sm font-semibold ring-1 ring-zinc-300 ring-inset hover:bg-zinc-50"
          >
            Quick season entry
          </Link>
          <Link
            href="/games/tournaments/new"
            className="inline-flex h-11 items-center rounded-lg px-4 text-sm font-semibold ring-1 ring-zinc-300 ring-inset hover:bg-zinc-50"
          >
            New tournament
          </Link>
          <Link
            href="/games/new"
            className="inline-flex h-11 items-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-on-brand hover:bg-brand-600"
          >
            Add game
          </Link>
        </div>
      </div>

      {added > 0 ? (
        <p role="status" className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">
          Added {added} game{added === 1 ? "" : "s"}.
        </p>
      ) : null}

      <div className="mt-6 mb-4 flex gap-1 border-b border-zinc-200">
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={v === "upcoming" ? "/games" : `/games?view=${v}`}
            aria-current={v === view ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize",
              v === view
                ? "border-brand-700 text-brand-900"
                : "border-transparent text-zinc-500 hover:text-zinc-800",
            )}
          >
            {v}
            {v === "upcoming" && upcoming.length > 0 ? (
              <span className="ml-1 text-xs text-zinc-400">{upcoming.length}</span>
            ) : null}
          </Link>
        ))}
      </div>

      {view === "tournaments" ? (
        tournaments.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-zinc-300 p-10 text-center">
            <p className="font-medium">No tournaments yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              Add a tournament with its dates, location, and bracket link, then add pool and bracket
              games to it.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {tournaments.toReversed().map((t) => {
              const tg = games.filter((g) => g.tournamentId === t.id);
              const r = recordOf(tg);
              return (
                <li key={t.id} className="rounded-xl bg-surface p-4 ring-1 ring-zinc-200">
                  <TournamentSummary
                    t={t}
                    href={`/games/tournaments/${t.id}`}
                    record={r.w + r.l + r.t > 0 ? formatRecord(r) : null}
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    {tg.length} game{tg.length === 1 ? "" : "s"}
                  </p>
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <GameList
          games={view === "results" ? results : upcoming}
          hrefFor={(g) => `/games/${g.id}`}
          today={today}
          showGroup
          empty={
            view === "results"
              ? "No results yet. Finished games show up here with their score."
              : "No upcoming games. Add one, or use Quick season entry to add the whole schedule."
          }
        />
      )}
    </div>
  );
}
