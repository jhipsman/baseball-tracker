import type { Metadata } from "next";
import { pickChild, requireParent } from "@/lib/parent";
import { MyStats } from "@/components/stats/my-stats";
import { ChildSwitcher, NoLinkedPlayer } from "../parent-ui";

export const metadata: Metadata = { title: "Stats" };

export default async function ParentStatsPage({ searchParams }: PageProps<"/parent/stats">) {
  const sp = await searchParams;
  const { children: kids } = await requireParent();
  const child = pickChild(kids, sp.player);
  if (!child) return <NoLinkedPlayer />;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{child.firstName}&apos;s stats</h1>
        <ChildSwitcher kids={kids} selected={child} basePath="/parent/stats" />
      </div>
      <MyStats
        playerId={child.id}
        firstName={child.firstName}
        basePath="/parent/stats"
        extra={kids.length > 1 ? { player: child.id } : undefined}
        searchParams={sp}
        gameHref={(id) => `/parent/games/${id}${kids.length > 1 ? `?player=${child.id}` : ""}`}
      />
    </div>
  );
}
