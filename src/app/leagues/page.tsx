import Link from "next/link";
import { playerToday } from "@/lib/player";
import {
  newestLeagues,
  newestTeams,
  scoreboard,
  searchLeagues,
  searchTeams,
  type ScoreGame,
} from "@/lib/leagues-data";
import { LeagueLine } from "@/components/leagues/league-view";
import { GameRow, TeamLine } from "@/components/leagues/game-row";
import { buttonClass } from "@/components/ui/button";

export const metadata = { title: { absolute: "9D Leagues · Baseball scores and schedules" } };

const shift = (d: string, n: number) =>
  new Date(new Date(`${d}T12:00:00Z`).getTime() + n * 864e5).toISOString().slice(0, 10);

function Board({ title, games, empty }: { title: string; games: ScoreGame[]; empty?: string }) {
  if (!games.length && !empty) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {games.length ? (
        <ul className="grid gap-px overflow-hidden rounded-2xl bg-zinc-200 ring-1 ring-zinc-200 md:grid-cols-2">
          {games.slice(0, 12).map((g) => (
            <li key={`${g.team_id}-${g.id}`} className="bg-surface">
              <GameRow g={g} team={g.team} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-surface p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
          {empty}
        </p>
      )}
    </section>
  );
}

export default async function LeaguesHome({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const { today } = await playerToday();
  const [games, found, foundLeagues, newest, leagues] = await Promise.all([
    scoreboard(shift(today, -3), shift(today, 7)),
    q ? searchTeams(q) : Promise.resolve(null),
    q ? searchLeagues(q) : Promise.resolve([]),
    newestTeams(),
    newestLeagues(),
  ]);
  const live = games.filter((g) => g.status === "live");
  const todays = games.filter((g) => g.date === today && g.status !== "live");
  const recent = games
    .filter((g) => g.date < today && g.status === "final")
    .sort((a, b) => b.date.localeCompare(a.date));
  const upcoming = games.filter((g) => g.date > today && g.status === "scheduled");

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
      <section className="hero overflow-hidden rounded-3xl px-6 py-10 text-neutral-50 sm:px-10 sm:py-14">
        <p className="text-xs font-semibold tracking-widest text-brand-400 uppercase">9D Leagues</p>
        <h1 className="mt-3 font-wordmark text-5xl leading-[0.95] tracking-tight uppercase italic sm:text-7xl">
          Every team. <span className="block text-brand-400">Every score.</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-neutral-200">
          Schedules, scores and records for baseball teams, from Little League to college. Free for
          any team.
        </p>
        <form action="/leagues" className="mt-6 flex max-w-lg gap-2" role="search">
          <label htmlFor="q" className="sr-only">
            Find a team
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Find a team, league or city"
            className="h-12 min-w-0 flex-1 rounded-full bg-neutral-50 px-5 text-base text-neutral-900 placeholder:text-neutral-500"
          />
          <button type="submit" className={buttonClass("primary", "h-12")}>
            Search
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-x-6">
          <Link
            href="/leagues/new"
            className="inline-flex min-h-11 items-center font-semibold text-brand-400 hover:underline"
          >
            Coach a team? Add it free →
          </Link>
          <Link
            href="/leagues/l/new"
            className="inline-flex min-h-11 items-center font-semibold text-brand-400 hover:underline"
          >
            Run a league? Start one →
          </Link>
        </div>
      </section>

      {foundLeagues.length ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Leagues matching “{q}”</h2>
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl bg-surface ring-1 ring-zinc-200">
            {foundLeagues.map((l) => (
              <li key={l.id}>
                <LeagueLine l={l} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {found ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            {found.length ? `Teams matching “${q}”` : `No teams match “${q}” yet`}
          </h2>
          {found.length ? (
            <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl bg-surface ring-1 ring-zinc-200">
              {found.map((t) => (
                <li key={t.id}>
                  <TeamLine t={t} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-600">
              Is it your team?{" "}
              <Link href="/leagues/new" className="font-semibold text-brand-700">
                Add it in a minute →
              </Link>
            </p>
          )}
        </section>
      ) : null}

      <Board title="Live now" games={live} />
      <Board title="Today" games={todays} empty="No games today." />
      <Board title="Recent results" games={recent} />
      <Board title="Coming up" games={upcoming} />

      {newest.length ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">New on 9D Leagues</h2>
          <ul className="grid gap-px overflow-hidden rounded-2xl bg-zinc-200 ring-1 ring-zinc-200 md:grid-cols-2">
            {newest.map((t) => (
              <li key={t.id} className="bg-surface">
                <TeamLine t={t} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {leagues.length ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Leagues</h2>
          <ul className="grid gap-px overflow-hidden rounded-2xl bg-zinc-200 ring-1 ring-zinc-200 md:grid-cols-2">
            {leagues.map((l) => (
              <li key={l.id} className="bg-surface">
                <LeagueLine l={l} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-surface p-6 ring-1 ring-zinc-200 sm:p-8">
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold">Run a league?</h2>
          <p className="mt-2 text-zinc-600">
            Add your teams and schedule, and standings update themselves as scores come in. Teams on
            9D report their scores automatically.
          </p>
        </div>
        <Link href="/leagues/l/new" className={buttonClass("primary")}>
          Start a league
        </Link>
      </section>
    </div>
  );
}
