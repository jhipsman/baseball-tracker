import Link from "next/link";
import { createTeam } from "@/lib/league-actions";
import { leaguesClient, linkableTeams } from "@/lib/leagues-data";
import { TeamForm } from "@/components/leagues/forms";
import { buttonClass } from "@/components/ui/button";

export const metadata = { title: "Add a team" };

export default async function NewTeam() {
  const { userId } = await leaguesClient();
  const links = userId ? await linkableTeams() : [];
  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Add your team</h1>
        <p className="mt-2 text-zinc-600">
          A free public page with your schedule, scores and record, to share with families, fans and
          opponents.
        </p>
      </header>
      {userId ? (
        <section className="rounded-3xl bg-surface p-5 ring-1 ring-zinc-200 sm:p-6">
          <TeamForm action={createTeam} links={links} submitLabel="Create team page" />
        </section>
      ) : (
        <section className="space-y-4 rounded-3xl bg-surface p-6 ring-1 ring-zinc-200">
          <p className="text-zinc-700">
            Create a free account so only you can update your team&apos;s page.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/signup?next=/leagues/new" className={buttonClass("primary")}>
              Create free account
            </Link>
            <Link href="/login?next=/leagues/new" className={buttonClass("secondary")}>
              Log in
            </Link>
          </div>
        </section>
      )}
      <p className="text-sm text-zinc-500">
        Only team schedules and scores are public. Nothing about players is shown.
      </p>
    </div>
  );
}
