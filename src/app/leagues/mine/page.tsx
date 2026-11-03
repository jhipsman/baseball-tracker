import Link from "next/link";
import { redirect } from "next/navigation";
import { leaguesClient, myTeams } from "@/lib/leagues-data";
import { TeamLine } from "@/components/leagues/game-row";
import { buttonClass } from "@/components/ui/button";

export const metadata = { title: "My teams" };

export default async function MyTeams() {
  const { userId } = await leaguesClient();
  if (!userId) redirect("/login?next=/leagues/mine");
  const teams = await myTeams();
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
      <Link href="/leagues/new" className={buttonClass("primary")}>
        Add a team
      </Link>
    </div>
  );
}
