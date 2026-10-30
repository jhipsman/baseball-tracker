import type { Metadata } from "next";
import { pickChild, requireParent } from "@/lib/parent";
import { playerToday } from "@/lib/player";
import { forGroups, loadGames, loadPlayerGroupIds, loadTournaments } from "@/lib/games";
import { ScheduleView } from "@/components/games/schedule-view";
import { ChildSwitcher, NoLinkedPlayer, withPlayer, ParentSectionTabs } from "../parent-ui";

export const metadata: Metadata = { title: "Games" };

export default async function ParentGamesPage({ searchParams }: PageProps<"/parent/games">) {
  const sp = await searchParams;
  const { supabase, org, children: kids } = await requireParent();
  const child = pickChild(kids, sp.player);
  if (!child) return <NoLinkedPlayer />;
  const { today } = await playerToday();

  const [games, tournaments, groupIds] = await Promise.all([
    loadGames(supabase, org.id, null, null),
    loadTournaments(supabase, org.id),
    loadPlayerGroupIds(supabase, child.id),
  ]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
          {child.firstName}&apos;s games
        </h1>
        <ChildSwitcher kids={kids} selected={child} basePath="/parent/games" />
        <ParentSectionTabs
          section="schedule"
          active="/parent/games"
          modules={org.modules}
          kids={kids}
          child={child}
        />
      </div>
      <ScheduleView
        games={forGroups(games, groupIds)}
        tournaments={forGroups(tournaments, groupIds)}
        today={today}
        hrefFor={(g) => withPlayer(`/parent/games/${g.id}`, kids, child)}
      />
    </div>
  );
}
