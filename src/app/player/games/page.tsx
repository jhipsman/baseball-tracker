import type { Metadata } from "next";
import { requireActiveOrg } from "@/lib/org";
import { playerToday } from "@/lib/player";
import { loadGames, loadTournaments } from "@/lib/games";
import { ScheduleView } from "@/components/games/schedule-view";

export const metadata: Metadata = { title: "Games" };

export default async function PlayerGamesPage() {
  const { supabase, org } = await requireActiveOrg();
  const { today } = await playerToday();
  // RLS: team-wide games plus the player's own groups.
  const [games, tournaments] = await Promise.all([
    loadGames(supabase, org.id, null, null),
    loadTournaments(supabase, org.id),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">Games</h1>
      <ScheduleView
        games={games}
        tournaments={tournaments}
        today={today}
        hrefFor={(g) => `/player/games/${g.id}`}
      />
    </div>
  );
}
