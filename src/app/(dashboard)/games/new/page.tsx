import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { loadGameFormOptions } from "@/lib/games";
import { NewGameForm } from "@/components/games/game-forms";

export const metadata: Metadata = { title: "Add game" };

export default async function NewGamePage({ searchParams }: PageProps<"/games/new">) {
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect("/player/games");
  const sp = await searchParams;
  const { today } = await playerToday();
  const { groups, tournaments } = await loadGameFormOptions(supabase, org.id);
  const tournamentId =
    typeof sp.tournament === "string" && tournaments.some((t) => t.id === sp.tournament)
      ? sp.tournament
      : null;

  return (
    <div className="max-w-2xl">
      <Link href="/games" className="text-sm text-zinc-500 hover:text-zinc-800">
        ← Games
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add game</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Adding a whole season?{" "}
        <Link href="/games/quick" className="font-medium text-brand-700 hover:underline">
          Use quick season entry
        </Link>
        .
      </p>
      <div className="mt-5 rounded-xl bg-white p-4 ring-1 ring-zinc-200 sm:p-6">
        <NewGameForm
          groups={groups}
          tournaments={tournaments}
          defaults={{
            date: today,
            kind: tournamentId ? "tournament" : "league",
            tournamentId,
            inningsScheduled: 7,
          }}
        />
      </div>
    </div>
  );
}
