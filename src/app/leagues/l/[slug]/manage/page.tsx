import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { playerToday } from "@/lib/player";
import { updateLeague } from "@/lib/league-admin-actions";
import { leagueBySlug, leaguesClient, loadLeague } from "@/lib/leagues-data";
import { siteOrigin } from "@/lib/site";
import { day } from "@/lib/staff-pay";
import {
  AddLeagueGame,
  DeleteLeagueButton,
  DivisionsEditor,
  LeagueForm,
  LeagueGameEditor,
  LeagueScheduleImport,
  TeamsEditor,
} from "@/components/leagues/league-admin";
import { CopyButton } from "@/components/ui/copy-button";
import { Disclosure } from "@/components/ui/disclosure";

export const metadata = { title: "Manage league" };

export default async function ManageLeague({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { slug } = await params;
  const { new: isNew } = await searchParams;
  const league = await leagueBySlug(slug);
  if (!league) notFound();
  const { userId } = await leaguesClient();
  if (!userId) redirect(`/login?next=/leagues/l/${slug}/manage`);
  if (league.owner_id !== userId) redirect(`/leagues/l/${slug}`);
  const [{ divisions, teams, byId, division, games }, { today }] = await Promise.all([
    loadLeague(league),
    playerToday(),
  ]);
  const url = `${await siteOrigin()}/leagues/l/${league.slug}`;
  const names = Object.fromEntries([...byId.values()].map((t) => [t.id, t.name]));
  const simple = teams.map((t) => ({ id: t.id, name: t.name }));
  const disputed = games.filter((g) => g.shown === "disputed");
  const card = "space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200 sm:p-5";

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <Link href={`/leagues/l/${league.slug}`} className="text-sm font-semibold text-brand-700">
          ← View league page
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{league.name}</h1>
      </header>

      <section
        className={
          isNew
            ? "space-y-2 rounded-2xl bg-brand-50 p-4 ring-1 ring-brand-200"
            : "space-y-2 rounded-2xl bg-surface p-4 ring-1 ring-zinc-200"
        }
      >
        <p className={isNew ? "font-semibold text-brand-900" : "font-semibold"}>
          {isNew
            ? "Your league is live. Add divisions (optional), teams, then the schedule."
            : "League link"}
        </p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-surface px-3 py-2 text-sm ring-1 ring-zinc-200">
            {url}
          </code>
          <CopyButton value={url} className="h-10 px-3" />
        </div>
      </section>

      {disputed.length ? (
        <p className="rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          {disputed.length} game{disputed.length === 1 ? " needs" : "s need"} your call: the teams
          reported different scores. See Scores below.
        </p>
      ) : null}

      <section className={card}>
        <h2 className="font-semibold">Divisions</h2>
        <DivisionsEditor leagueId={league.id} divisions={divisions} />
      </section>

      <section className={card}>
        <h2 className="font-semibold">Teams ({teams.length})</h2>
        <TeamsEditor
          leagueId={league.id}
          divisions={divisions}
          teams={teams.map((t) => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            divisionId: division.get(t.id) ?? null,
          }))}
        />
      </section>

      <section className={card}>
        <h2 className="font-semibold">Schedule</h2>
        {teams.length < 2 ? (
          <p className="text-sm text-zinc-600">Add at least two teams first.</p>
        ) : (
          <>
            <LeagueScheduleImport leagueId={league.id} teams={simple} />
            <Disclosure label="Add one game" openLabel="Close">
              <AddLeagueGame leagueId={league.id} teams={simple} today={today} />
            </Disclosure>
          </>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Scores</h2>
        <p className="text-sm text-zinc-600">
          Scores fill in from each team&apos;s page. Enter one here only to fix or settle a game;
          yours always wins.
        </p>
        {games.length ? (
          <ul className="divide-y divide-zinc-200 rounded-2xl bg-surface ring-1 ring-zinc-200">
            {[...games]
              .sort((a, b) => {
                const rank = (s: string) => (s === "disputed" ? 0 : 1);
                return rank(a.shown) - rank(b.shown) || b.date.localeCompare(a.date);
              })
              .map((g) => (
                <li key={g.id} className="space-y-2 px-4 py-3">
                  <p className="text-sm font-medium">
                    {day(g.date)} · {names[g.away_team_id]} @ {names[g.home_team_id]}
                    {g.shown === "final" ? (
                      <span className="text-zinc-500">
                        {" "}
                        · Final {g.away}–{g.home}
                      </span>
                    ) : null}
                  </p>
                  <LeagueGameEditor leagueId={league.id} g={g} names={names} />
                </li>
              ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-surface p-4 text-sm text-zinc-600 ring-1 ring-zinc-200">
            No games yet.
          </p>
        )}
      </section>

      <section className={card}>
        <Disclosure label="Edit league details" openLabel="Close">
          <LeagueForm action={updateLeague} league={league} submitLabel="Save" />
        </Disclosure>
      </section>
      <DeleteLeagueButton id={league.id} name={league.name} />
    </div>
  );
}
