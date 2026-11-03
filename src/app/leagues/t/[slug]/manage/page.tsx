import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { playerToday } from "@/lib/player";
import { updateTeam } from "@/lib/league-actions";
import { leaguesClient, linkableTeams, teamBySlug, teamGames } from "@/lib/leagues-data";
import { matchup, clock } from "@/lib/leagues";
import { day } from "@/lib/staff-pay";
import { siteOrigin } from "@/lib/site";
import { AddGameForm, DeleteTeamButton, GameEditor, TeamForm } from "@/components/leagues/forms";
import { CopyButton } from "@/components/ui/copy-button";
import { LogoUpload, ScheduleImport } from "@/components/leagues/uploads";
import { Disclosure } from "@/components/ui/disclosure";

export const metadata = { title: "Manage team" };

export default async function ManageTeam({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { slug } = await params;
  const { new: isNew } = await searchParams;
  const team = await teamBySlug(slug);
  if (!team) notFound();
  const { userId } = await leaguesClient();
  if (!userId) redirect(`/login?next=/leagues/t/${slug}/manage`);
  if (team.owner_id !== userId) redirect(`/leagues/t/${slug}`);
  const [games, links, { today }] = await Promise.all([
    teamGames(team.id),
    linkableTeams(),
    playerToday(),
  ]);
  const url = `${await siteOrigin()}/leagues/t/${team.slug}`;
  const sorted = [...games].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <Link href={`/leagues/t/${team.slug}`} className="text-sm font-semibold text-brand-700">
          ← View public page
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{team.name}</h1>
      </header>

      <section
        className={
          isNew
            ? "space-y-2 rounded-2xl bg-brand-50 p-4 ring-1 ring-brand-200"
            : "space-y-2 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200"
        }
      >
        <p className={isNew ? "font-semibold text-brand-900" : "font-semibold"}>
          {isNew ? "Your team page is live. Share it with your families:" : "Your public link"}
        </p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-surface px-3 py-2 text-sm ring-1 ring-zinc-200">
            {url}
          </code>
          <CopyButton value={url} className="h-10 px-3" />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200 sm:p-5">
        <h2 className="font-semibold">Logo</h2>
        <LogoUpload teamId={team.id} name={team.name} logoPath={team.logo_path} />
      </section>

      {team.org_id ? (
        <p className="rounded-2xl bg-surface p-4 text-sm text-zinc-700 ring-1 ring-zinc-200">
          <b>Linked to your 9D team.</b> Games and scores come from your 9D schedule and live
          scoring automatically, so there&apos;s nothing to enter here.
        </p>
      ) : (
        <>
          <section className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200 sm:p-5">
            <div>
              <h2 className="font-semibold">Bring in your schedule</h2>
              <p className="text-sm text-zinc-600">
                Add the whole season at once. Games already here are skipped.
              </p>
            </div>
            <ScheduleImport teamId={team.id} teamName={team.name} />
          </section>
          <section className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200 sm:p-5">
            <h2 className="font-semibold">Add one game</h2>
            <AddGameForm teamId={team.id} today={today} />
          </section>
          <section className="space-y-2">
            <h2 className="font-semibold">Games</h2>
            {sorted.length ? (
              <ul className="divide-y divide-zinc-200 rounded-2xl bg-surface ring-1 ring-zinc-200">
                {sorted.map((g) => (
                  <li key={g.id} className="space-y-2 px-4 py-3">
                    <p className="font-medium">
                      {day(g.date)} · {matchup(g)}
                      <span className="text-sm font-normal text-zinc-500">
                        {[clock(g.start_time), g.location].filter(Boolean).map((x) => ` · ${x}`)}
                        {g.status === "postponed" || g.status === "canceled"
                          ? ` · ${g.status === "postponed" ? "Postponed" : "Canceled"}`
                          : ""}
                      </span>
                    </p>
                    <GameEditor
                      id={g.id}
                      status={g.status}
                      us={g.team_score}
                      them={g.opponent_score}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl bg-surface p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
                No games yet. Add your first one above.
              </p>
            )}
          </section>
        </>
      )}

      <section className="space-y-2 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200 sm:p-5">
        <Disclosure label="Edit team details" openLabel="Close">
          <TeamForm action={updateTeam} team={team} links={links} submitLabel="Save" />
        </Disclosure>
      </section>
      <DeleteTeamButton id={team.id} name={team.name} />
    </div>
  );
}
