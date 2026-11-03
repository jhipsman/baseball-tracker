import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { playerToday } from "@/lib/player";
import { leaguesClient, leaguesForTeam, teamBySlug, teamGames } from "@/lib/leagues-data";
import { levelLabel, logoUrl, record } from "@/lib/leagues";
import { TeamLogo } from "@/components/leagues/team-logo";
import { GameRow, VerifiedBadge } from "@/components/leagues/game-row";
import { CopyButton } from "@/components/ui/copy-button";
import { buttonClass } from "@/components/ui/button";
import { siteOrigin } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const team = await teamBySlug((await params).slug);
  if (!team) return { title: "Team not found" };
  const where = [team.city, team.state].filter(Boolean).join(", ");
  return {
    title: team.name,
    description: `${team.name}${where ? ` (${where})` : ""}: schedule, scores and record on 9D Leagues.`,
    openGraph: team.logo_path ? { images: [logoUrl(team.logo_path)!] } : undefined,
  };
}

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await teamBySlug(slug);
  if (!team) notFound();
  const [{ userId }, games, { today }, leagues] = await Promise.all([
    leaguesClient(),
    teamGames(team.id),
    playerToday(),
    leaguesForTeam(team.id),
  ]);
  const rec = record(games);
  const live = games.filter((g) => g.status === "live");
  const results = games
    .filter(
      (g) =>
        g.status === "final" || (g.date < today && g.status !== "scheduled" && g.status !== "live"),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const upcoming = games.filter(
    (g) => g.date >= today && (g.status === "scheduled" || g.status === "postponed"),
  );
  const unscored = games.filter((g) => g.date < today && g.status === "scheduled");
  const where = [team.city, team.state].filter(Boolean).join(", ");
  const url = `${await siteOrigin()}/leagues/t/${team.slug}`;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <header className="hero rounded-3xl px-6 py-8 text-neutral-50 sm:px-8">
        <div className="flex items-center gap-4">
          <TeamLogo
            name={team.name}
            src={logoUrl(team.logo_path)}
            className="size-16 rounded-2xl text-xl ring-white/20 sm:size-20 sm:text-2xl"
          />
          <div className="min-w-0">
            <p className="text-sm text-neutral-300">
              {[levelLabel(team.level), team.age_group, where].filter(Boolean).join(" · ")}
            </p>
            <h1 className="mt-1 flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {team.name}
              {team.verified ? <VerifiedBadge /> : null}
            </h1>
          </div>
        </div>
        {leagues.length ? (
          <p className="mt-4 flex flex-wrap gap-2 text-sm">
            {leagues.map((l) => (
              <Link
                key={l.id}
                href={`/leagues/l/${l.slug}`}
                className="rounded-full bg-white/10 px-3 py-1 font-semibold text-neutral-50 ring-1 ring-white/20 hover:bg-white/20"
              >
                🏆 {l.name}
                {l.season ? ` · ${l.season}` : ""}
              </Link>
            ))}
          </p>
        ) : null}
        <dl className="mt-6 grid max-w-md grid-cols-3 gap-3">
          {[
            ["Record", rec.text],
            ["Runs", `${rec.runsFor}–${rec.runsAgainst}`],
            ["Streak", rec.streak || "—"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-white/10 px-3 py-2 ring-1 ring-white/15">
              <dt className="text-xs text-neutral-300">{k}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex flex-wrap gap-2">
          <CopyButton
            value={url}
            className="inline-flex h-11 items-center rounded-full px-5 text-sm text-neutral-50 ring-white/30 hover:bg-white/10"
          />
          {userId && team.owner_id === userId ? (
            <Link href={`/leagues/t/${team.slug}/manage`} className={buttonClass("secondary")}>
              Manage team
            </Link>
          ) : null}
        </div>
      </header>

      {live.length ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Live now</h2>
          <ul className="overflow-hidden rounded-2xl bg-surface ring-1 ring-zinc-200">
            {live.map((g) => (
              <li key={g.id}>
                <GameRow g={g} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Schedule</h2>
        {upcoming.length ? (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl bg-surface ring-1 ring-zinc-200">
            {upcoming.map((g) => (
              <li key={g.id}>
                <GameRow g={g} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-surface p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
            No games scheduled.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Results</h2>
        {results.length ? (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl bg-surface ring-1 ring-zinc-200">
            {results.map((g) => (
              <li key={g.id}>
                <GameRow g={g} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-surface p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
            No results yet.
          </p>
        )}
        {unscored.length ? (
          <p className="text-sm text-zinc-500">
            {unscored.length} past game{unscored.length === 1 ? " has" : "s have"} no score yet.
          </p>
        ) : null}
      </section>

      {!team.verified ? (
        <p className="text-sm text-zinc-500">
          Scores on this page are entered by the team.{" "}
          <Link href="/home" className="font-semibold text-brand-700">
            Teams on 9D update automatically →
          </Link>
        </p>
      ) : null}
    </div>
  );
}
