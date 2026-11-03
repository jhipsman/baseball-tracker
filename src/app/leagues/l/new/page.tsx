import Link from "next/link";
import { createLeague } from "@/lib/league-admin-actions";
import { leaguesClient } from "@/lib/leagues-data";
import { LeagueForm } from "@/components/leagues/league-admin";
import { buttonClass } from "@/components/ui/button";

export const metadata = { title: "Start a league" };

export default async function NewLeague() {
  const { userId } = await leaguesClient();
  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Start a league</h1>
        <p className="mt-2 text-zinc-600">
          Add your teams and schedule. Standings update themselves as scores come in, and teams on
          9D report their scores automatically.
        </p>
      </header>
      {userId ? (
        <section className="rounded-3xl bg-surface p-5 ring-1 ring-zinc-200 sm:p-6">
          <LeagueForm action={createLeague} submitLabel="Create league" />
        </section>
      ) : (
        <section className="space-y-4 rounded-3xl bg-surface p-6 ring-1 ring-zinc-200">
          <p className="text-zinc-700">Create a free account so only you can run the league.</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/signup?next=/leagues/l/new" className={buttonClass("primary")}>
              Create free account
            </Link>
            <Link href="/login?next=/leagues/l/new" className={buttonClass("secondary")}>
              Log in
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
