import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { playerToday } from "@/lib/player";
import { leagueBySlug, leaguesClient, loadLeague, type TeamCard } from "@/lib/leagues-data";
import { levelLabel } from "@/lib/leagues";
import { standings, type ResolvedGame } from "@/lib/league-standings";
import { siteOrigin } from "@/lib/site";
import { LeagueGame, StandingsTable } from "@/components/leagues/league-view";
import { TeamLine } from "@/components/leagues/game-row";
import { CopyButton } from "@/components/ui/copy-button";
import { buttonClass } from "@/components/ui/button";

function GameList({
  list,
  teams,
  limit,
}: {
  list: ResolvedGame[];
  teams: Map<string, TeamCard>;
  limit?: number;
}) {
  return (
    <ul className="grid gap-px overflow-hidden rounded-2xl bg-zinc-200 ring-1 ring-zinc-200 md:grid-cols-2">
      {list.slice(0, limit ?? list.length).map((g) => (
        <li key={g.id} className="bg-surface">
          <LeagueGame g={g} teams={teams} />
        </li>
      ))}
    </ul>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const l = await leagueBySlug((await params).slug);
  if (!l) return { title: "League not found" };
  return {
    title: [l.name, l.season].filter(Boolean).join(" · "),
    description: `Standings, schedule and scores for ${l.name}${l.season ? ` (${l.season})` : ""} on 9D Leagues.`,
  };
}

export default async function LeaguePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const league = await leagueBySlug(slug);
  if (!league) notFound();
  const [{ userId }, data, { today }] = await Promise.all([
    leaguesClient(),
    loadLeague(league),
    playerToday(),
  ]);
  const { divisions, teams, byId, division, games } = data;
  const groups = divisions.length
    ? [
        ...divisions.map((d) => ({
          title: d.name,
          ids: teams.filter((t) => division.get(t.id) === d.id).map((t) => t.id),
        })),
        {
          title: "Not in a division",
          ids: teams.filter((t) => !division.get(t.id)).map((t) => t.id),
        },
      ].filter((g) => g.ids.length)
    : [{ title: undefined, ids: teams.map((t) => t.id) }];
  const live = games.filter((g) => g.shown === "live");
  const results = games
    .filter(
      (g) =>
        g.shown === "final" || (g.date < today && g.shown !== "scheduled" && g.shown !== "live"),
    )
    .reverse();
  const upcoming = games.filter((g) => g.date >= today && g.shown === "scheduled");
  const disputed = games.filter((g) => g.shown === "disputed").length;
  const where = [league.city, league.state].filter(Boolean).join(", ");
  const url = `${await siteOrigin()}/leagues/l/${league.slug}`;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <header className="hero rounded-3xl px-6 py-8 text-neutral-50 sm:px-8">
        <p className="text-sm text-neutral-300">
          {[league.season, levelLabel(league.level), where].filter(Boolean).join(" · ")}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{league.name}</h1>
        <p className="mt-2 text-sm text-neutral-300">
          {teams.length} team{teams.length === 1 ? "" : "s"} · {games.length} game
          {games.length === 1 ? "" : "s"}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <CopyButton
            value={url}
            className="inline-flex h-11 items-center rounded-full px-5 text-sm text-neutral-50 ring-white/30 hover:bg-white/10"
          />
          {userId && league.owner_id === userId ? (
            <Link href={`/leagues/l/${league.slug}/manage`} className={buttonClass("secondary")}>
              Manage league
            </Link>
          ) : null}
        </div>
      </header>

      {live.length ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Live now</h2>
          <GameList list={live} teams={byId} />
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Standings</h2>
        {teams.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {groups.map((g) => (
              <StandingsTable
                key={g.title ?? "all"}
                title={g.title}
                rows={standings(g.ids, games)}
                teams={byId}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-surface p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
            No teams yet.
          </p>
        )}
        {disputed ? (
          <p className="text-sm text-amber-900">
            {disputed} game{disputed === 1 ? " has" : "s have"} a disputed score and{" "}
            {disputed === 1 ? "isn't" : "aren't"} counted until the league sets it.
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Coming up</h2>
        {upcoming.length ? (
          <GameList list={upcoming} teams={byId} limit={12} />
        ) : (
          <p className="rounded-2xl bg-surface p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
            No games scheduled.
          </p>
        )}
      </section>

      {results.length ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Results</h2>
          <GameList list={results} teams={byId} limit={12} />
        </section>
      ) : null}

      {upcoming.length > 12 || results.length > 12 ? (
        <details className="rounded-2xl bg-surface ring-1 ring-zinc-200">
          <summary className="cursor-pointer px-4 py-3 font-semibold">
            Full schedule ({games.length} games)
          </summary>
          <GameList list={games} teams={byId} />
        </details>
      ) : null}

      {teams.length ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Teams</h2>
          <ul className="grid gap-px overflow-hidden rounded-2xl bg-zinc-200 ring-1 ring-zinc-200 md:grid-cols-2">
            {teams.map((t) => (
              <li key={t.id} className="bg-surface">
                <TeamLine t={t} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-sm text-zinc-500">
        Scores come from each team&apos;s page (teams on 9D report automatically). When two teams
        disagree, the league decides.
      </p>
    </div>
  );
}
