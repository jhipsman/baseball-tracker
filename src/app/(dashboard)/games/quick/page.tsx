import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveOrg } from "@/lib/org";
import { loadGameFormOptions } from "@/lib/games";
import { QuickEntryForm } from "@/components/games/game-forms";

export const metadata: Metadata = { title: "Quick season entry" };

export default async function QuickEntryPage() {
  const { supabase, org, isStaff } = await requireActiveOrg();
  if (!isStaff) redirect("/player/games");
  const { groups, tournaments } = await loadGameFormOptions(supabase, org.id);

  return (
    <div className="max-w-5xl">
      <Link href="/games" className="text-sm text-zinc-500 hover:text-zinc-800">
        ← Games
      </Link>
      <h1 className="mt-2 text-2xl font-medium tracking-tight sm:text-3xl">Quick season entry</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Type in the whole schedule: one row per game. Type, group, and arrival time apply to every
        game here; open any game later to add an address or notes.
      </p>
      <div className="mt-5 rounded-xl bg-surface p-4 ring-1 ring-zinc-200">
        <QuickEntryForm groups={groups} tournaments={tournaments} doneHref="/games" />
      </div>
    </div>
  );
}
