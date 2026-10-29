import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { loadGameFormOptions } from "@/lib/games";
import { NewTournamentForm } from "@/components/games/game-forms";

export const metadata: Metadata = { title: "New tournament" };

export default async function NewTournamentPage() {
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect("/player/games");
  const { today } = await playerToday();
  const { groups } = await loadGameFormOptions(supabase, org.id);
  return (
    <div className="max-w-2xl">
      <Link href="/games?view=tournaments" className="text-sm text-zinc-500 hover:text-zinc-800">
        ← Tournaments
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">New tournament</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Add the dates, place, and bracket link. You can add pool and bracket games next.
      </p>
      <div className="mt-5 rounded-xl bg-white p-4 ring-1 ring-zinc-200 sm:p-6">
        <NewTournamentForm groups={groups} today={today} />
      </div>
    </div>
  );
}
