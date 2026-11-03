import Link from "next/link";
import { redirect } from "next/navigation";
import { leaguesClient, myLeagues, myTeams } from "@/lib/leagues-data";
import { LeagueLine } from "@/components/leagues/league-view";
import { TeamLine } from "@/components/leagues/game-row";
import { buttonClass } from "@/components/ui/button";

export const metadata = { title: "My teams" };

export default async function MyTeams() {
  const { userId } = await leaguesClient();
  if (!userId) redirect("/login?next=/leagues/mine");
  const [teams, leagues] = await Promise.all([myTeams(), myLeagues()]);
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">My teams</h1>
      {teams.length ? (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl bg-surface ring-1 ring-zinc-200">
          {teams.map((t) => (
            <li key={t.id}>
              <TeamLine t={t} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-zinc-600">You haven&apos;t added a team yet.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Link href="/leagues/new" className={buttonClass("primary")}>
          Add a team
        </Link>
      </div>
      <h2 className="pt-4 text-2xl font-semibold tracking-tight">My leagues</h2>
      {leagues.length ? (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl bg-surface ring-1 ring-zinc-200">
          {leagues.map((l) => (
            <li key={l.id}>
              <LeagueLine l={l} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-zinc-600">You don&apos;t run a league yet.</p>
      )}
      <Link href="/leagues/l/new" className={buttonClass("secondary")}>
        Start a league
      </Link>
    </div>
  );
}
